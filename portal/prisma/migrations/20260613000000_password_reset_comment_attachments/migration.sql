-- Add password reset fields to User
ALTER TABLE "User" ADD COLUMN "passwordResetToken" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordResetExpiry" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_passwordResetToken_key" ON "User"("passwordResetToken");

-- Add commentId to Attachment (links photos to the comment they were uploaded with)
ALTER TABLE "Attachment" ADD COLUMN "commentId" TEXT;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_commentId_fkey"
  FOREIGN KEY ("commentId") REFERENCES "TicketComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
