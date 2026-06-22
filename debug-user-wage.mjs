import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function run() {
    const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/items/user_wage_management?limit=5`;
    const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` }
    });
    console.log(JSON.stringify(await res.json(), null, 2));
}
run();
