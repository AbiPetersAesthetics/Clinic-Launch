import path from "path";

// Where user-uploaded files live. Locally this is ./uploads in the repo;
// on Render it points at the persistent disk (UPLOADS_DIR=/var/data/uploads).
export const UPLOADS_ROOT: string =
  process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
