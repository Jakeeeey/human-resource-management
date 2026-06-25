import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function run() {
    const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/items/payroll_logistics_staff?limit=100`;
    const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` }
    });
    const json = await res.json();
    console.log(JSON.stringify(json.data.filter(s => [1, 10, 11, 1010, 1011].includes(s.staff_id)), null, 2));
}
run();
