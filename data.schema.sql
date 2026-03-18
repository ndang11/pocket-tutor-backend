-- customizing pg vector
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id text NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(768),
  created_at timestamptz DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX ON document_chunks
USING ivfflat (embedding vector_cosine_ops);

-- match_document_chunks
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(3072),
  match_document_id text,
  match_user_id text,
  match_count int
)
RETURNS TABLE (
  id uuid,
  document_id text,
  user_id text,
  chunk_index int,
  content text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    document_id,
    user_id,
    chunk_index,
    content,
    1 - (embedding <=> query_embedding) AS similarity
  FROM document_chunks
  WHERE document_id = match_document_id
    AND user_id = match_user_id
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
-- drop table rag 3072
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow all" ON document_chunks
FOR ALL
USING (true)
WITH CHECK (true);