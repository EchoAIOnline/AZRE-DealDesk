UPDATE "Agents"
SET name = trim(concat(
    COALESCE(NULLIF(TRIM("agentFirstName"), ''), ''), 
    ' ', 
    COALESCE(NULLIF(TRIM("agentLastName"), ''), '')
))
WHERE (NULLIF(TRIM("agentFirstName"), '') IS NOT NULL) OR (NULLIF(TRIM("agentLastName"), '') IS NOT NULL);
