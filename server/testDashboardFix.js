const testDashboardRoles = async () => {
  try {
    const rolesToTest = [
      { name: 'Super Admin', email: 'super_admin@jslabels.com', password: 'Test1234!' },
      { name: 'Manager', email: 'manager@jslabels.com', password: 'Test1234!' },
      { name: 'Caller', email: 'caller@jslabels.com', password: 'Test1234!' }
    ];

    for (const r of rolesToTest) {
      console.log(`\nTesting role: ${r.name} (${r.email})...`);
      const loginRes = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: r.email, password: r.password })
      });

      const cookies = loginRes.headers.getSetCookie();
      const headers = { 'Cookie': cookies.join('; ') };

      // 1. Fetch dashboard summary
      const sumRes = await fetch('http://localhost:5000/api/dashboard/summary', { headers });
      console.log(`- GET /api/dashboard/summary -> Status ${sumRes.status}`);

      // 2. Fetch users caller list
      const usersRes = await fetch('http://localhost:5000/api/users?role=caller', { headers });
      console.log(`- GET /api/users?role=caller -> Status ${usersRes.status}`);

      if (sumRes.status === 200 && usersRes.status === 200) {
        console.log(`SUCCESS: ${r.name} fetched dashboard summary and callers list without 403 error!`);
      } else {
        console.error(`FAILED: ${r.name} encountered non-200 status!`);
      }
    }

  } catch (err) {
    console.error('Error testing dashboard fix:', err);
  }
};

testDashboardRoles();
