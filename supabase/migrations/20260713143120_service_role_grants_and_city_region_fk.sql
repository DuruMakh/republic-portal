-- service_role needs explicit SQL privileges (RLS bypass does not bypass grants)
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

-- a profile's city must belong to its region (Data API can bypass UI cascades)
alter table cities add constraint cities_id_region_unique unique (id, region_id);
alter table profiles add constraint profiles_city_in_region
  foreign key (city_id, region_id) references cities (id, region_id);
