import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function run() {
    const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/items/payroll_logistics_salary_matrix?limit=100`;
    const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` }
    });
    console.log(await res.json());
}
run();
