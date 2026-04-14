async function debugLogin() {
    const payload = {
        email: "definitely_not_a_user@test.com",
        password: "password123"
    };

    try {
        const res = await fetch("http://localhost:8080/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log("STATUS:", res.status);
        console.log("RESPONSE:", JSON.stringify(data, null, 2));
    } catch(err) {
        console.error("DEBUG FETCH FAILED:", err);
    }
}
debugLogin();

