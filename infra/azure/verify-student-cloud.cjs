const {PrismaClient}=require('@prisma/client');
const jwt=require('jsonwebtoken');
const {randomUUID}=require('node:crypto');
const assert=require('node:assert/strict');
const prisma=new PrismaClient();
const api=process.env.CLOUD_VERIFY_SMOKE_API_URL;
assert.ok(api, 'CLOUD_VERIFY_SMOKE_API_URL is required');
const ids=[randomUUID(),randomUUID()];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const token=id=>jwt.sign({sub:id},process.env.JWT_SECRET,{expiresIn:'15m'});
async function call(path,who,method='GET',body){
 const response=await fetch(api+path,{method,headers:{Authorization:'Bearer '+token(who),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json(); return {status:response.status,data};
}
(async()=>{
 try{
  await prisma.user.createMany({data:ids.map(id=>({id,firstName:'Synthetic deployment verification'}))});
  const coldStart=Date.now();let httpReady=false;
  while(Date.now()-coldStart<240000){
   try{const r=await fetch(api+'/health/ready',{signal:AbortSignal.timeout(65000)});if(r.ok){httpReady=true;break;}}catch{}
   await sleep(5000);
  }
  assert.ok(httpReady,'Cold HTTP readiness did not finish');
  console.log(JSON.stringify({coldHttpReadySeconds:Math.round((Date.now()-coldStart)/1000)}));
  const unauthorized=await fetch(api+'/sms/'+randomUUID()+'/verification');assert.equal(unauthorized.status,401);
  const sourceId='student-release-smoke:'+randomUUID();
  const payload={sender:'BANTAI_TEST',maskedBody:'Meeting at school tomorrow. Please bring your notebook.',sourceId,receivedAt:new Date().toISOString(),label:'Ham',score:0.8,bucket:'safe'};
  const first=await call('/sms/ingest',ids[0],'POST',payload);assert.equal(first.status,201);
  const messageId=first.data.id??first.data.messageId;assert.ok(messageId);
  const jobId=first.data.cloudVerification?.jobId;assert.ok(jobId);
  const duplicate=await call('/sms/ingest',ids[0],'POST',payload);assert.equal(duplicate.status,201);assert.equal(duplicate.data.cloudVerification.jobId,jobId);
  const other=await call('/sms/'+messageId+'/verification',ids[1]);assert.equal(other.status,404);
  const start=Date.now();let result;
  while(Date.now()-start<600000){
   const current=await call('/sms/'+messageId+'/verification',ids[0]);assert.equal(current.status,200);
   result=current.data.cloudVerification;
   if(result.status==='verified'||result.status==='failed')break;
   await sleep(10000);
  }
  assert.equal(result.status,'verified',result.lastError??'verification did not finish');
  assert.equal(result.modelVersion,'candidate-2026-09-21-colab-C-local');
  assert.equal(result.approvedArtifactDigest,'2ee84d99a8da734f803e9b20677231879c8e52089d4d407c44a9abff45a817e8');
  const row=await prisma.smsMessage.findUnique({where:{id:messageId},include:{classification:true,cloudVerifications:true,alerts:true}});
  assert.equal(row.trusted,true);assert.equal(row.cloudVerifications.length,1);assert.ok(row.classification);assert.ok(row.alerts.length<=1);
  console.log(JSON.stringify({cloudAuthenticatedProof:true,unauthorized:401,crossUser:404,duplicateSameJob:true,verified:true,version:result.modelVersion,bundleDigest:result.approvedArtifactDigest,attempts:result.attempts,elapsedSeconds:Math.round((Date.now()-start)/1000),classification:row.classification.label,alertCount:row.alerts.length}));
 }finally{
  await prisma.$transaction(async tx=>{
   const whereMessage={message:{userId:{in:ids}}};
   await tx.explainableIndicator.deleteMany({where:{classification:whereMessage}});
   await tx.alert.deleteMany({where:whereMessage});
   await tx.messageFeature.deleteMany({where:whereMessage});
   await tx.classification.deleteMany({where:whereMessage});
   await tx.cloudVerificationJob.deleteMany({where:whereMessage});
   await tx.cloudVerificationAdmission.deleteMany({where:{userId:{in:ids}}});
   await tx.smsMessage.deleteMany({where:{userId:{in:ids}}});
   await tx.user.deleteMany({where:{id:{in:ids}}});
  });
  await prisma.$disconnect();
 }
})().catch(error=>{console.error('Deployment verification failed:',error.message);process.exitCode=1});