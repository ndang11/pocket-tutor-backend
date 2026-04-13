-- Create study_history table for tracking user study activities
CREATE TABLE IF NOT EXISTS study_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('flashcard', 'quiz', 'chat', 'document')),
    title TEXT NOT NULL,
    description TEXT,
    duration INTEGER,
    score INTEGER,
    "totalQuestions" INTEGER,
    "correctAnswers" INTEGER,
    "documentId" TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_study_history_userId ON study_history("userId");
CREATE INDEX IF NOT EXISTS idx_study_history_type ON study_history(type);
CREATE INDEX IF NOT EXISTS idx_study_history_created_at ON study_history(created_at DESC);
