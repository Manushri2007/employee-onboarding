
const STORAGE_KEY = 'eo_employees';

// small helpers
const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));
const showToast = (txt, ms=2200) => {
  const t = qs('#toast'); t.textContent = txt; t.style.display='block';
  setTimeout(()=> t.style.display='none', ms);
};

// --------- Navigation & UI ----------
function showSection(id){
  qsa('.section').forEach(s=> s.style.display='none');
  qs(`#${id}`).style.display='block';
  // hide detail panel if open
  qs('#detailPanel') && (qs('#detailPanel').style.display='none');
}

// Start Add flow (clears forms, stepper)
function startAdd(editId=null){
  resetForms();
  editingId = editId;
  qs('#doneBox') && (qs('#doneBox').style.display='none');
  // stepper
  setStep(1);
  showSection('formSection');
  qs('#personalForm').style.display='grid';
  qs('#officialForm').style.display='none';
  if(editId) prefillForEdit(editId);
}

// Cancel Add
function cancelAdd(){
  resetForms();
  showSection('home');
}

// Set step UI
function setStep(n){
  qsa('.step').forEach((el,idx)=> {
    if(idx+1===n) el.classList.add('active'); else el.classList.remove('active');
  });
}

// --------- Avatar handling ----------
let avatarData = ''; // base64 string
qs && qs('#p_avatar')?.addEventListener('change', function(e){
  const f = e.target.files[0];
  if(!f) return;
  if(f.size > 300*1024){ showToast('Image too large (max 300KB)'); return; }
  const reader = new FileReader();
  reader.onload = ()=> {
    avatarData = reader.result;
    const img = qs('#avatarPreview');
    img.src = avatarData; img.style.display='block';
  };
  reader.readAsDataURL(f);
});

// --------- Form navigation
function toOfficial(){
  const p = collectPersonal();
  if(!p) return;
  localStorage.setItem('eo_tempPersonal', JSON.stringify(p));
  setStep(2);
  qs('#personalForm').style.display='none';
  qs('#officialForm').style.display='grid';
}

function toPersonal(){
  setStep(1);
  qs('#officialForm').style.display='none';
  qs('#personalForm').style.display='grid';
}

// collect & validate personal form
function collectPersonal(){
  const fullName = qs('#p_fullName').value.trim();
  const dob = qs('#p_dob').value;
  const gender = qs('#p_gender').value;
  const phone = qs('#p_phone').value.trim();
  const email = qs('#p_email').value.trim();
  const address = qs('#p_address').value.trim();

  if(!fullName || !dob || !gender || !phone || !email || !address){
    showToast('Please fill all personal fields');
    return null;
  }
  // basic phone check
  if(!/^\d{6,15}$/.test(phone)){ showToast('Enter valid phone digits'); return null; }

  // use existing avatarData if set, else keep previous if editing
  const tempAvatar = avatarData || qs('#avatarPreview')?.src || '';

  return { fullName,dob,gender,phone,email,address,avatar:tempAvatar };
}

// Save employee (final)
let editingId = null;
function saveEmployee(){
  const official = {
    empId: qs('#o_empId').value.trim(),
    department: qs('#o_department').value,
    designation: qs('#o_designation').value,
    joinDate: qs('#o_joinDate').value,
    location: qs('#o_location').value,
    salary: qs('#o_salary').value.trim()
  };
  if(!official.empId || !official.department || !official.designation || !official.joinDate || !official.location){
    showToast('Please fill all official fields');
    return;
  }

  const personal = JSON.parse(localStorage.getItem('eo_tempPersonal') || 'null');
  if(!personal){
    showToast('Personal details missing — please fill personal form');
    setTimeout(()=> toPersonal(), 600);
    return;
  }

  // Build employee object
  const employee = {...personal, ...official, created: new Date().toISOString() };

  // load all
  const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

  if(editingId){
    // find and replace
    const idx = arr.findIndex(e=> e.empId === editingId);
    if(idx !== -1){ arr[idx] = employee; showToast('Updated employee'); }
    else { arr.push(employee); showToast('Saved employee'); }
    editingId = null;
  } else {
    // prevent duplicate empId
    if(arr.some(e=> e.empId === employee.empId)){
      showToast('Employee ID already exists. Use unique ID.');
      return;
    }
    arr.push(employee);
    showToast('Employee saved');
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  localStorage.removeItem('eo_tempPersonal');
  avatarData = '';
  // show done
  setStep(3);
  qs('#personalForm').style.display='none';
  qs('#officialForm').style.display='none';
  qs('#doneBox').style.display='block';
  qs('#doneMsg').textContent = `${employee.fullName} (${employee.empId}) saved successfully.`;
}

// --------- Grid / Detail rendering ----------
function renderGrid(){
  showSection('gridSection');
  const grid = qs('#grid'); grid.innerHTML = '';
  const q = qs('#searchInput')?.value?.toLowerCase?.() || '';

  const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

  if(arr.length === 0){
    grid.innerHTML = '<p style="color:#6b537a">No employees yet. Click "Add Employee" to begin.</p>';
    return;
  }

  const filtered = arr.filter(e => {
    return e.fullName.toLowerCase().includes(q) || e.empId.toLowerCase().includes(q);
  });

  filtered.forEach(emp => {
    const div = document.createElement('div'); div.className='card-mini';
    div.innerHTML = `
      <div class="mini-avatar">${emp.avatar ? `<img src="${emp.avatar}" style="width:64px;height:64px;border-radius:10px;object-fit:cover;">` : emp.fullName.split(' ').map(n=>n[0]).slice(0,2).join('')}</div>
      <div class="mini-body">
        <h4>${emp.fullName}</h4>
        <p>${emp.empId} • ${emp.designation}</p>
      </div>
      <div class="card-actions">
        <button class="btn ghost" onclick="viewDetail('${emp.empId}')">View</button>
        <button class="btn" onclick="editEmployee('${emp.empId}')">Edit</button>
        <button class="btn ghost" onclick="deleteEmployee('${emp.empId}')">Delete</button>
      </div>
    `;
    grid.appendChild(div);
  });
}

// view detail
function viewDetail(empId){
  const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const emp = arr.find(e=> e.empId === empId);
  if(!emp) { showToast('Employee not found'); return; }

  const panel = qs('#detailPanel'); const card = qs('#detailCard');
  card.innerHTML = `
    ${emp.avatar ? `<img src="${emp.avatar}" class="detail-avatar">` : ''}
    <h3>${emp.fullName} <small style="font-size:13px;color:#7b4db0">(${emp.empId})</small></h3>
    <div class="detail-row"><div class="profile-label">Designation</div><div>${emp.designation}</div></div>
    <div class="detail-row"><div class="profile-label">Department</div><div>${emp.department}</div></div>
    <div class="detail-row"><div class="profile-label">Joining</div><div>${emp.joinDate}</div></div>
    <div class="detail-row"><div class="profile-label">Location</div><div>${emp.location}</div></div>
    <div class="detail-row"><div class="profile-label">Salary</div><div>₹ ${emp.salary || '-'}</div></div>
    <hr>
    <div class="detail-row"><div class="profile-label">Phone</div><div>${emp.phone}</div></div>
    <div class="detail-row"><div class="profile-label">Email</div><div>${emp.email}</div></div>
    <div class="detail-row"><div class="profile-label">DOB</div><div>${emp.dob}</div></div>
    <div class="detail-row"><div class="profile-label">Address</div><div>${emp.address}</div></div>
    <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
      <button class="btn ghost" onclick="editEmployee('${emp.empId}')">Edit</button>
      <button class="btn ghost" onclick="deleteEmployee('${emp.empId}')">Delete</button>
    </div>
  `;
  panel.style.display='block';
}

// close detail
function closeDetail(){ qs('#detailPanel').style.display='none'; }

// edit -> prefill forms and set editingId
function editEmployee(empId){
  const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const emp = arr.find(e=> e.empId === empId);
  if(!emp){ showToast('Employee not found'); return; }
  editingId = empId;

  // fill personal
  qs('#p_fullName').value = emp.fullName;
  qs('#p_dob').value = emp.dob;
  qs('#p_gender').value = emp.gender;
  qs('#p_phone').value = emp.phone;
  qs('#p_email').value = emp.email;
  qs('#p_address').value = emp.address;
  if(emp.avatar){ qs('#avatarPreview').src = emp.avatar; qs('#avatarPreview').style.display='block'; } else { qs('#avatarPreview').style.display='none'; }
  avatarData = emp.avatar || '';

  // save temp personal
  localStorage.setItem('eo_tempPersonal', JSON.stringify({
    fullName: emp.fullName,dob:emp.dob,gender:emp.gender,phone:emp.phone,email:emp.email,address:emp.address,avatar:emp.avatar||''
  }));

  // fill official
  qs('#o_empId').value = emp.empId;
  qs('#o_department').value = emp.department;
  qs('#o_designation').value = emp.designation;
  qs('#o_joinDate').value = emp.joinDate;
  qs('#o_location').value = emp.location;
  qs('#o_salary').value = emp.salary || '';

  // show forms at official (so user can save)
  setStep(2);
  showSection('formSection');
  qs('#personalForm').style.display='none';
  qs('#officialForm').style.display='grid';
  window.scrollTo({top:0,behavior:'smooth'});
}

// delete employee
function deleteEmployee(empId){
  if(!confirm('Delete this employee permanently?')) return;
  let arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  arr = arr.filter(e=> e.empId !== empId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  showToast('Deleted');
  renderGrid();
  qs('#detailPanel').style.display='none';
}

// reset forms
function resetForms(){
  // clear personal
  ['#p_fullName','#p_dob','#p_gender','#p_phone','#p_email','#p_address','#p_avatar','#avatarPreview'].forEach(s=>{
    const el = qs(s); if(!el) return;
    if(el.tagName==='INPUT' || el.tagName==='TEXTAREA' || el.tagName==='SELECT') el.value = '';
    if(el.tagName==='IMG') el.style.display='none';
  });
  avatarData = '';
  // clear official
  ['#o_empId','#o_department','#o_designation','#o_joinDate','#o_location','#o_salary'].forEach(s=>{
    const el=qs(s); if(!el) return; el.value='';
  });
  localStorage.removeItem('eo_tempPersonal');
  editingId = null;
  setStep(1);
}

// prefill when editing from startAdd (if ID provided)
function prefillForEdit(id){
  if(!id) return;
  editEmployee(id);
}

// clear all localStorage data (danger)
function clearAll(){
  if(!confirm('Clear ALL employee data?')) return;
  localStorage.removeItem(STORAGE_KEY);
  showToast('All data cleared');
  renderGrid();
}

// on load: show home
(function init(){
  showSection('home');
  // wire personal next by saving temp personal on input change (so edits persist)
  ['#p_fullName','#p_dob','#p_gender','#p_phone','#p_email','#p_address'].forEach(sel=>{
    const el = qs(sel);
    if(!el) return;
    el.addEventListener('input', ()=>{
      const p = collectPersonal();
      if(p) localStorage.setItem('eo_tempPersonal', JSON.stringify(p));
    });
  });

  // if there's a temp personal restore it
  const temp = JSON.parse(localStorage.getItem('eo_tempPersonal') || 'null');
  if(temp){
    qs('#p_fullName').value=temp.fullName||'';
    qs('#p_dob').value=temp.dob||'';
    qs('#p_gender').value=temp.gender||'';
    qs('#p_phone').value=temp.phone||'';
    qs('#p_email').value=temp.email||'';
    qs('#p_address').value=temp.address||'';
    if(temp.avatar){ qs('#avatarPreview').src=temp.avatar; qs('#avatarPreview').style.display='block'; avatarData=temp.avatar; }
  }

})();
