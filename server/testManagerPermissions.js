const testPermissions = async () => {
  try {
    console.log('1. Logging in as Manager (manager@jslabels.com)...');
    const mgrLogin = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'manager@jslabels.com', password: 'Test1234!' })
    });

    const body = await mgrLogin.json();
    console.log('Manager Permissions Returned from Auth API:');
    console.log(JSON.stringify(body.permissions, null, 2));

    const usersAccess = body.permissions?.users || [];
    const settingsAccess = body.permissions?.settings || [];

    console.log(`Users view access for manager? ${usersAccess.includes('view') ? 'YES (FAIL)' : 'NO (HIDDEN - SUCCESS)'}`);
    console.log(`Settings view access for manager? ${settingsAccess.includes('view') ? 'YES (FAIL)' : 'NO (HIDDEN - SUCCESS)'}`);

    console.log('\n2. Logging in as Super Admin...');
    const adminLogin = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'super_admin@jslabels.com', password: 'Test1234!' })
    });
    const adminBody = await adminLogin.json();
    console.log(`Users view access for super_admin? ${adminBody.permissions?.users?.includes('view') ? 'YES (VISIBLE - SUCCESS)' : 'NO'}`);
    console.log(`Settings view access for super_admin? ${adminBody.permissions?.settings?.includes('view') ? 'YES (VISIBLE - SUCCESS)' : 'NO'}`);

  } catch (err) {
    console.error('Error testing manager permissions:', err);
  }
};

testPermissions();
