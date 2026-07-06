import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function run() {
    const cutoffStart = "2026-06-11";
    const cutoffEnd = "2026-06-25";
    const aprParams = new URLSearchParams();
    aprParams.set("limit", "10");
    aprParams.set("filter[_and][0][cutoff_start][_eq]", cutoffStart);
    aprParams.set("filter[_and][1][cutoff_end][_eq]", cutoffEnd);

    const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/items/payroll_other_additions?${aprParams.toString()}`;
    const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` }
    });
    console.log(await res.text());
}
run();
