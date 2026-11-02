-- Remove only synthetic records created by the automated end-to-end checks.
-- Dependent records are removed explicitly because the production schema keeps
-- audit and marketplace foreign keys restrictive on purpose.
CREATE TEMP TABLE cleanup_qa_users ON COMMIT DROP AS
SELECT id
  FROM users
 WHERE email LIKE 'qa%@example.com'
    OR email LIKE 'maestro-%@example.com'
    OR email LIKE 'weak-%@example.com';

CREATE TEMP TABLE cleanup_qa_projects ON COMMIT DROP AS
SELECT id
  FROM projects
 WHERE client_id IN (SELECT id FROM cleanup_qa_users);

DELETE FROM moderation_reports
 WHERE reporter_user_id IN (SELECT id FROM cleanup_qa_users)
    OR resolved_by IN (SELECT id FROM cleanup_qa_users)
    OR (target_type = 'user' AND target_id IN (SELECT id FROM cleanup_qa_users))
    OR (target_type = 'project' AND target_id IN (SELECT id FROM cleanup_qa_projects));

DELETE FROM audit_log
 WHERE actor_user_id IN (SELECT id FROM cleanup_qa_users)
    OR (target_type = 'user' AND target_id IN (SELECT id FROM cleanup_qa_users))
    OR (target_type = 'project' AND target_id IN (SELECT id FROM cleanup_qa_projects));

UPDATE verification_requests
   SET reviewed_by = NULL
 WHERE reviewed_by IN (SELECT id FROM cleanup_qa_users);

DELETE FROM messages
 WHERE sender_user_id IN (SELECT id FROM cleanup_qa_users);

DELETE FROM quotes
 WHERE company_user_id IN (SELECT id FROM cleanup_qa_users);

DELETE FROM projects
 WHERE id IN (SELECT id FROM cleanup_qa_projects);

DELETE FROM uploads
 WHERE user_id IN (SELECT id FROM cleanup_qa_users);

DELETE FROM users
 WHERE id IN (SELECT id FROM cleanup_qa_users);
