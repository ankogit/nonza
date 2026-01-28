export interface MeetingDocument {
  id: string;
  room_id: string;
  title: string;
  content: string;
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentOperation {
  id: string;
  document_id: string;
  operation_type: "insert" | "delete" | "retain";
  position: number;
  content?: string;
  length?: number;
  created_by: string | null;
  created_at: string;
}
