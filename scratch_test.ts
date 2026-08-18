import fs from "fs";

async function main() {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://goatedcodoer:8056";
    const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "B95t8gP4b2f-nXZ2eF8Qj7Vb9mC2yKx"; // I should get it from .env.local

    // read .env.local
    const env = fs.readFileSync(".env.local", "utf8");
    const tokenMatch = env.match(/DIRECTUS_STATIC_TOKEN=(.*)/);
    const token = tokenMatch ? tokenMatch[1].trim() : STATIC_TOKEN;
    const urlMatch = env.match(/NEXT_PUBLIC_API_BASE_URL=(.*)/);
    const url = urlMatch ? urlMatch[1].trim() : API_BASE_URL;

    console.log("Fetching fields for company_handbook...");
    const res = await fetch(`${url}/fields/company_handbook`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    console.log(JSON.stringify(data.data.map((f: any) => f.field), null, 2));

    console.log("Fetching fields for company_handbook_attachments...");
    const res2 = await fetch(`${url}/fields/company_handbook_attachments`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const data2 = await res2.json();
    console.log(JSON.stringify(data2.data?.map((f: any) => f.field) || "Not found", null, 2));

    console.log("Fetching handbook 1...");
    const res3 = await fetch(`${url}/items/company_handbook?fields=*.*`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const data3 = await res3.json();
    console.log(JSON.stringify(data3.data, null, 2));
}

main().catch(console.error);
