import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function run() {
    const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/users?limit=100`;
    const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` }
    });
    const users = (await res.json()).data;
    if (users) {
        console.log("Users exist with IDs:", users.map(u => u.id || u.user_id).filter(id => [1, 10, 11, 100, 1010, 1011].includes(Number(id))));
    } else {
        console.log("no users");
    }
}
run();
