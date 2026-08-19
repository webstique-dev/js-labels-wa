const testJobs = async () => {
  try {
    console.log('1. Logging in as Super Admin...');
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'super_admin@jslabels.com',
        password: 'Test1234!'
      })
    });

    const cookies = loginRes.headers.getSetCookie();
    console.log('Login successful! Session cookie obtained.');

    const headers = {
      'Content-Type': 'application/json',
      'Cookie': cookies.join('; ')
    };

    console.log('\n2. Triggering Reorder Reminder Job (POST /api/dev/run-reminder-job)...');
    const reminderRes = await fetch('http://localhost:5000/api/dev/run-reminder-job', {
      method: 'POST',
      headers
    });
    const reminderData = await reminderRes.json();
    console.log('Reminder Job Output:', JSON.stringify(reminderData, null, 2));

    console.log('\n3. Triggering Escalation Job (POST /api/dev/run-escalation-job)...');
    const escalationRes = await fetch('http://localhost:5000/api/dev/run-escalation-job', {
      method: 'POST',
      headers
    });
    const escalationData = await escalationRes.json();
    console.log('Escalation Job Output:', JSON.stringify(escalationData, null, 2));

    console.log('\n4. Fetching Escalations (GET /api/escalations?stage=md_review)...');
    const escalationsRes = await fetch('http://localhost:5000/api/escalations?stage=md_review', {
      headers
    });
    const escalationsData = await escalationsRes.json();
    console.log(`Fetched ${escalationsData.length} escalation records.`);

  } catch (err) {
    console.error('Error running test script:', err);
  }
};

testJobs();
