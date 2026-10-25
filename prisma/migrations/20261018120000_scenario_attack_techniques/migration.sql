-- MITRE ATT&CK technique IDs a scenario exercises (links scenarios <-> /attack explorer).
ALTER TABLE "scenarios" ADD COLUMN     "techniques" TEXT[] DEFAULT ARRAY[]::TEXT[];
