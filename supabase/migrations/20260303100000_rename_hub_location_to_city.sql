-- Rename hub_location column to city in hubs table (if it exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'hubs' 
        AND column_name = 'hub_location'
    ) THEN
        ALTER TABLE public.hubs RENAME COLUMN hub_location TO city;
        RAISE NOTICE 'Renamed hub_location to city';
    ELSE
        RAISE NOTICE 'hub_location column does not exist';
    END IF;
END $$;
