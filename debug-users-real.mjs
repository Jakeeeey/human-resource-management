import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function run() {
    const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/items/user?limit=5`;
    const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` }
    });
    const users = (await res.json()).data;
    if (users) {
        console.log(users.map(u => u.user_id));
    }
}
run();
