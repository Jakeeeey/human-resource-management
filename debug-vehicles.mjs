import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function run() {
    const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/items/vehicles?limit=5&fields=vehicle_id,vehicle_plate,vehicle_type.*`;
    const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` }
    });
    console.log(JSON.stringify(await res.json(), null, 2));
}
run();
