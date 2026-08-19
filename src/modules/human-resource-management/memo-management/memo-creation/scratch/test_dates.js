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
            const memo = data.data[0];
            console.log("raw approved_at:", memo.approved_at);
            console.log("raw approved_by:", memo.approved_by);
            console.log("raw created_at:", memo.created_at);
            console.log("raw updated_at:", memo.updated_at);
        } else {
            console.log("Memo MM-20260818-001 not found");
        }
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

run();
