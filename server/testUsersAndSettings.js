const testWorkflow = async () => {
  try {
    console.log('1. Logging in as Super Admin...');
    const adminLogin = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'super_admin@jslabels.com', password: 'Test1234!' })
    });
    const adminCookies = adminLogin.headers.getSetCookie();
    const headers = { 'Content-Type': 'application/json', 'Cookie': adminCookies.join('; ') };

    console.log('\n2. Creating a new test caller user (testcaller@jslabels.com)...');
    const createUserRes = await fetch('http://localhost:5000/api/users', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Test Caller Executive',
        email: 'testcaller@jslabels.com',
        phone: '+91 99999 88888',
        role: 'caller',
        password: 'Test1234!'
      })
    });
    const createdUser = await createUserRes.json();
    console.log('Created User ID:', createdUser._id, createdUser.name);

    console.log('\n3. Creating a Lead assigned to Test Caller Executive...');
    const createLeadRes = await fetch('http://localhost:5000/api/leads', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Acme Test Corp',
        company: 'Acme Ltd',
        phone: '+91 91111 22222',
        email: 'acme@test.com',
        source: 'website',
        priority: 'high',
        assignedTo: createdUser._id
      })
    });
    const createdLead = await createLeadRes.json();
    console.log('Created Lead ID:', createdLead._id, 'AssignedTo:', createdLead.assignedTo);

    console.log('\n4. Attempting to deactivate Test Caller Executive (PATCH /api/users/:id/deactivate)...');
    const deactRes = await fetch(`http://localhost:5000/api/users/${createdUser._id}/deactivate`, {
      method: 'PATCH',
      headers
    });
    const deactBody = await deactRes.json();
    console.log('Deactivate Check Result:', deactBody);
    console.log(`Prompt for reassignment triggered? ${deactBody.hasOpenItems === true ? 'YES (SUCCESS)' : 'NO'}`);

    console.log('\n5. Reassigning items to main caller and deactivating (POST /api/users/:id/reassign-and-deactivate)...');
    const mainCallerRes = await fetch('http://localhost:5000/api/users?role=caller', { headers });
    const callers = await mainCallerRes.json();
    const targetCaller = callers.find(c => c._id !== createdUser._id && c.status === 'active');

    const reassignRes = await fetch(`http://localhost:5000/api/users/${createdUser._id}/reassign-and-deactivate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reassignTo: targetCaller._id })
    });
    const reassignBody = await reassignRes.json();
    console.log('Reassign Result:', reassignBody);

    // Verify lead assignedTo updated
    const leadCheck = await fetch(`http://localhost:5000/api/leads`, { headers });
    const leadsList = await leadCheck.json();
    const updatedLead = leadsList.leads.find(l => l._id === createdLead._id);
    console.log(`Lead reassigned to target caller (${targetCaller.name})? ${updatedLead.assignedTo?._id === targetCaller._id ? 'YES (VERIFIED)' : 'NO'}`);

    console.log('\n6. Updating Settings escalation timing to { warning: 1, escalation: 2, mdReview: 3 }...');
    const settingsRes = await fetch('http://localhost:5000/api/settings', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        escalationDelaysHours: { warning: 1, escalation: 2, mdReview: 3 }
      })
    });
    const updatedSettings = await settingsRes.json();
    console.log('Updated Settings Escalation Hours:', updatedSettings.escalationDelaysHours);

    console.log('\n7. Triggering Escalation Job to verify new timing...');
    const cronRes = await fetch('http://localhost:5000/api/dev/run-escalation-job', { method: 'POST', headers });
    const cronBody = await cronRes.json();
    console.log('Escalation Job Result:', cronBody);

  } catch (err) {
    console.error('Error in test workflow:', err);
  }
};

testWorkflow();
