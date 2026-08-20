const token = "AAKv73dkIV8DfAIA5vEt3eXVdIebzmBW";
const baseUrl = "http://100.110.197.61:8056";

async function run() {
    try {
        const res = await fetch(`${baseUrl}/items/company_memo?filter[memo_no][_eq]=MM-20260818-001&limit=1`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });
        const data = await res.json();
        if (data.data && data.data.length > 0) {
            console.log("EXACT MEMO BODY FROM DIRECTUS:");
            console.log(JSON.stringify(data.data[0].body));
        } else {
            console.log("Memo MM-20260818-001 not found");
        }
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

run();
