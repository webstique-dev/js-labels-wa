const testSecurity = async () => {
  try {
    console.log('1. Logging in as Caller (caller@jslabels.com)...');
    const callerLogin = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'caller@jslabels.com', password: 'Test1234!' })
    });
    const callerCookies = callerLogin.headers.getSetCookie();

    console.log('2. Attempting to fetch GET /api/reports/overview as Caller...');
    const callerRes = await fetch('http://localhost:5000/api/reports/overview', {
      headers: { 'Cookie': callerCookies.join('; ') }
    });

    console.log(`Caller Response Status: ${callerRes.status} ${callerRes.statusText}`);
    const callerBody = await callerRes.json();
    console.log('Caller Response Body:', callerBody);

    console.log('\n3. Logging in as Super Admin...');
    const adminLogin = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'super_admin@jslabels.com', password: 'Test1234!' })
    });
    const adminCookies = adminLogin.headers.getSetCookie();

    console.log('4. Fetching GET /api/reports/overview as Super Admin...');
    const adminRes = await fetch('http://localhost:5000/api/reports/overview', {
      headers: { 'Cookie': adminCookies.join('; ') }
    });

    console.log(`Admin Response Status: ${adminRes.status} ${adminRes.statusText}`);
    const adminBody = await adminRes.json();
    console.log('Admin Overview Data:', JSON.stringify(adminBody, null, 2));

  } catch (err) {
    console.error('Error testing reports security:', err);
  }
};

testSecurity();
