-- Remove only synthetic accounts created by the automated end-to-end checks.
DELETE FROM users
 WHERE email LIKE 'qa%@example.com'
    OR email LIKE 'maestro-%@example.com'
    OR email LIKE 'weak-%@example.com';
