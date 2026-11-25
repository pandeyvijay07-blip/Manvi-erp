MANVI ERP V30 — COMPLETE SOURCE PACKAGE
========================================

This package contains the complete project source based on the V29 ZIP you supplied,
with the V30 page/layout updates applied. It is intended as a new working copy.

WHAT IS INCLUDED
----------------
- Updated app layout/navigation
- Updated Sales page
- Updated Purchase page
- Updated Collections page with daily route / missing-entry status
- Updated Dashboard with daily route completion summary
- Updated Customers page
- Updated Customer Ledger
- Existing Suppliers page and the rest of the V29 modules
- Existing CSS consolidated into src/components/manvi-ui.css

WHAT IS NOT INCLUDED
--------------------
- node_modules (install locally with npm ci)
- dist build output
- your private .env file / Supabase credentials
- no Supabase schema migration or live database change

INSTALLATION
------------
1. Keep your current V29 project as a backup. Do not delete it.
2. Extract this package to a new folder named MANVI_ERP_V30.
3. Copy your existing V29 .env file into the new MANVI_ERP_V30 folder.
   Do not share the .env file with anyone. The .env.example file only shows the names.
4. Open the MANVI_ERP_V30 folder in VS Code.
5. Open Terminal and run:
       npm ci
       npm run build
       npm run dev
6. Open the local URL shown by Vite.

IMPORTANT
---------
- The app will use the same Supabase project as the .env file you copy over.
- No database tables or records are modified by extracting this package.
- Do not test by saving a real sale, purchase, collection, or payment until you
  have confirmed the calculations with sample/test data.
- Do not deploy this package until all business workflows are tested.

VALIDATION NOTE
---------------
The updated src entry and imported TypeScript application modules passed a strict
TypeScript check in the supplied source environment. A production Vite build could
not be completed in this Linux validation environment because the uploaded
node_modules contained the Windows Rollup binary rather than the Linux binary.
Run npm ci on your own computer to install the correct platform dependencies,
then run npm run build before using or deploying the app.
