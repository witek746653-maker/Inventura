-- Add current_quantity column to items table
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS current_quantity numeric NOT NULL DEFAULT 0;

-- Optional: ensure RLS allows updates if enabled
-- ALTER POLICY "Enable update for all users" ON "public"."items" FOR UPDATE USING (true) WITH CHECK (true);
