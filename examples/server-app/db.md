1. Check if it's running with `psql --version`, if it is skip to step, otherwise continue to step 2.
2. Initialize: `initdb -E UTF8 --locale=en_US.utf8 -U postgres -D "C:\Program Files\PostgreSQL\18\data\"`
3. Start the PostgreSQL server: `pg_ctl start -D "C:\Program Files\PostgreSQL\18\data\"`
4. Add the following to the Path environment variable: `C:\Program Files\PostgreSQL\18\bin ;C:\Program Files\PostgreSQL\18\lib`
5. Connect to PostgreSQL server: `psql -U postgres`
6. Set up the database:
```sql
-- Create a dedicated user for this project's database
CREATE USER USER_NAME;

-- Grant permissions to the user to create databases
ALTER USER USER_NAME CREATEDB;

-- Create database
CREATE DATABASE DB_NAME;

-- Grant privileges to the user
GRANT ALL PRIVILEGES ON DATABASE DB_NAME TO USER_NAME;

-- Set user as owner
ALTER DATABASE DB_NAME OWNER TO USER_NAME;
```
7. Exit: `\q`

In the backend folder, look for the `.env` file and change the `DATABASE_URL` line to the following line:
```bash
DATABASE_URL="postgresql://USER_NAME:PASSWORD@localhost:5432/DB_NAME?schema=public"
```

# Useful commands
### Start database
`pg_ctl start -D "C:\Program Files\PostgreSQL\18\data\"`

### Migrate schema
1. `npx prisma migrate dev`
2. `npx prisma generate`

### Seed mock data
`npx prisma db seed` (or `npm run seed`) — also runs automatically after `prisma migrate dev` and `prisma migrate reset`. Mock data lives in `database/mockdata.sql`.

### Connect to database
`psql DB_NAME -U USER_NAME`