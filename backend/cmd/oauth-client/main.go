package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	"nonza/backend/internal/config"
	"nonza/backend/internal/migrations"
	"nonza/backend/internal/models"
	"nonza/backend/internal/repository"
	"nonza/backend/internal/repository/postgresDB"
	"nonza/backend/internal/service/auth"
	"nonza/backend/internal/service/oauth"

	_ "github.com/lib/pq"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	cfg, err := config.Init()
	if err != nil {
		log.Fatal(err)
	}

	db, err := postgresDB.NewPostgresDB(postgresDB.Config{
		Host:        cfg.DB.Host,
		Port:        cfg.DB.Port,
		Username:    cfg.DB.Username,
		Password:    cfg.DB.Password,
		DBName:      cfg.DB.DBName,
		SSLMode:     cfg.DB.SSLMode,
		Environment: cfg.Env,
	})
	if err != nil {
		log.Fatal(err)
	}
	defer postgresDB.CloseDB(db)

	if err := migrations.RunMigrations(db); err != nil {
		log.Fatal(err)
	}

	repos := repository.NewRepositories(db)
	authSvc := auth.NewAuthService(repos.Users, cfg)
	oauthSvc := oauth.NewOAuthService(
		repos.OAuthClients,
		repos.OAuthCodes,
		repos.OAuthRefreshTokens,
		repos.Users,
		authSvc,
		cfg,
	)

	switch os.Args[1] {
	case "create":
		runCreate(oauthSvc, os.Args[2:])
	case "list":
		runList(oauthSvc)
	case "deactivate":
		runDeactivate(oauthSvc, os.Args[2:])
	default:
		printUsage()
		os.Exit(1)
	}
}

func runCreate(svc oauth.OAuth, args []string) {
	fs := flag.NewFlagSet("create", flag.ExitOnError)
	name := fs.String("name", "", "Application display name")
	redirectURIs := fs.String("redirect-uris", "", "Comma-separated redirect URIs")
	scopes := fs.String("scopes", "openid,profile,offline_access", "Comma-separated scopes")
	clientType := fs.String("type", models.OAuthClientTypeConfidential, "Client type: confidential or public")
	trusted := fs.Bool("trusted", false, "Skip consent screen for logged-in users")
	orgID := fs.String("organization-id", "", "Organization UUID for partner temporary-room API")
	_ = fs.Parse(args)

	uris := parseList(*redirectURIs)
	for _, a := range fs.Args() {
		if strings.HasPrefix(a, "--redirect-uri=") {
			uris = append(uris, strings.TrimPrefix(a, "--redirect-uri="))
		}
	}

	var orgPtr *string
	if strings.TrimSpace(*orgID) != "" {
		orgPtr = orgID
	}

	result, err := svc.CreateClient(oauth.CreateClientParams{
		Name:           *name,
		RedirectURIs:   uris,
		Scopes:         parseList(*scopes),
		ClientType:     *clientType,
		Trusted:        *trusted,
		OrganizationID: orgPtr,
	})
	if err != nil {
		log.Fatal(err)
	}

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(result); err != nil {
		log.Fatal(err)
	}
}

func runList(svc oauth.OAuth) {
	clients, err := svc.ListClients()
	if err != nil {
		log.Fatal(err)
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(clients); err != nil {
		log.Fatal(err)
	}
}

func runDeactivate(svc oauth.OAuth, args []string) {
	fs := flag.NewFlagSet("deactivate", flag.ExitOnError)
	clientID := fs.String("client-id", "", "OAuth client_id")
	_ = fs.Parse(args)
	if *clientID == "" && len(fs.Args()) > 0 {
		*clientID = fs.Args()[0]
	}
	if *clientID == "" {
		log.Fatal("client-id is required")
	}
	if err := svc.DeactivateClient(*clientID); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("deactivated %s\n", *clientID)
}

func parseList(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func printUsage() {
	fmt.Println(`Usage:
  oauth-client create --name "Partner App" --redirect-uri "https://partner.example/oauth/callback" [--organization-id ORG_UUID] [--scopes openid,profile,offline_access] [--trusted] [--type confidential|public]
  oauth-client list
  oauth-client deactivate --client-id nz_...`)
}
