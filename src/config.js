/* ------------------------------------------------------------
   App configuration.

   MOCK = true  -> standalone mode: no server, no database. Data lives in
                   localStorage, seeded with demo data. Works fully offline.
                   This is the default for `npm run dev`.

   MOCK = false -> talks to the real Express API (server/) backed by
                   PostgreSQL, with login. This is what makes data persist
                   and stay in sync across devices, anywhere.

   Driven by VITE_MOCK:
     - `npm run dev`   -> no flag set -> MOCK = true  (offline, no server)
     - `npm run build` -> .env.production sets VITE_MOCK=false -> live database
   Override anytime:  VITE_MOCK=false npm run dev   (dev against the real DB)
   ------------------------------------------------------------ */
export const MOCK = import.meta.env.VITE_MOCK !== "false";
