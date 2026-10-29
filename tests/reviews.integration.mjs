// Local fixtures only; never uses existing customer credentials or modifies existing orders.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const base=process.env.PERSON3_API_URL||'http://localhost:5121';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local API required');
const tag='review-'+randomUUID().replaceAll('-',''), users=[],products=[];
let category;
const sql=q=>execFileSync('sqlcmd',['-S',process.env.PERSON3_SQL_SERVER||'.'+String.fromCharCode(92)+'SQLEXPRESS','-d',process.env.PERSON3_SQL_DATABASE||'GemstoneShop','-E','-C','-b','-h','-1','-W','-Q','SET NOCOUNT ON; '+q],{encoding:'utf8'}).trim();
const num=q=>Number(sql(q));
async function call(token,method,path,body){
 const form=body instanceof FormData;
 const r=await fetch(base+'/api'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(!form&&body?{'Content-Type':'application/json'}:{})},body:form?body:body?JSON.stringify(body):undefined});
 const text=await r.text();let data;try{data=JSON.parse(text);}catch{data=text;}return{status:r.status,data};
}
function ok(r,status=200){assert.equal(r.status,status,JSON.stringify(r.data));return r.data;}
async function user(role='Customer'){
 const email=tag+'-'+users.length+'@example.invalid',password=randomUUID()+'Aa9!';
 ok(await call(null,'POST','/auth/register',{fullName:tag,email,password}));
 const id=num(`SELECT Id FROM Users WHERE Email='${email}'`);users.push(id);
 if(role==='Admin')sql(`UPDATE Users SET RoleId=(SELECT Id FROM Roles WHERE Name='Admin') WHERE Id=${id}`);
 return{id,...ok(await call(null,'POST','/auth/login',{email,password}))};
}
function purchased(u,p,status='Completed'){
 sql(`INSERT Orders(UserId,StatusId,RecipientName,RecipientPhone,ShippingAddress,TotalAmount,CreatedAt,PaymentMethod,PaymentStatus,PaidAt)
 SELECT ${u.id},Id,N'${tag}','0000000000',N'Temporary fixture',1000000,SYSUTCDATETIME(),'COD','Paid',SYSUTCDATETIME() FROM OrderStatuses WHERE Name='${status}';
 DECLARE @id int=CONVERT(int,SCOPE_IDENTITY());
 INSERT OrderDetails(OrderId,ProductId,ProductName,Quantity,UnitPrice) VALUES(@id,${p},N'${tag}',1,1000000);`);
}
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA2QAAAAASUVORK5CYII=','base64');
function upload(count=1,bytes=png){const form=new FormData();for(let i=0;i<count;i++)form.append('files',new Blob([bytes],{type:'image/png'}),'../../untrusted.png');return form;}
try{
 assert.equal(num('SELECT 1'),1);
 const admin=await user('Admin'),a=await user(),b=await user(),c=await user();
 category=ok(await call(admin.token,'POST','/categories',{name:tag,isActive:true}),201).id;
 for(let i=0;i<3;i++)products.push(ok(await call(admin.token,'POST','/products',{name:tag+'-'+i,categoryId:category,isActive:true,stock:5,price:1000000+i*100000}),201).id);
 const [p,inactive]=products,path='/products/'+p+'/reviews';
 ok(await call(null,'POST',path,{rating:5,content:'Good'}),401);
 ok(await call(a.token,'POST',path,{rating:5,content:'Good'}),403);
 for(const status of ['Pending','Confirmed','Shipping','Cancelled']){purchased(a,inactive,status);ok(await call(a.token,'POST','/products/'+inactive+'/reviews',{rating:4,content:'Invalid purchase'}),403);}
 purchased(a,p);purchased(b,p);purchased(c,p);
 for(const rating of [0,6])ok(await call(a.token,'POST',path,{rating,content:'Invalid'}),400);
 ok(await call(a.token,'POST',path,{rating:4,content:' '.repeat(4)}),400);
 ok(await call(a.token,'POST',path,{rating:4,content:'x'.repeat(2001)}),400);
 const race=await Promise.all([call(a.token,'POST',path,{rating:5,content:'Beautiful gem'}),call(a.token,'POST',path,{rating:5,content:'Beautiful gem'})]);
 assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
 let r=race.find(r=>r.status===200).data;
 assert.equal(r.verifiedPurchase,true);assert.equal(r.isOwn,true);
 const created=r.createdAt;
 r=ok(await call(a.token,'PUT',path+'/me',{rating:4,content:'Updated review'}));assert.equal(r.createdAt,created);assert.ok(r.updatedAt);
 assert.equal(num(`SELECT COUNT(*) FROM ProductReviews WHERE UserId=${a.id} AND ProductId=${p}`),1);
 ok(await call(b.token,'DELETE','/reviews/'+r.id+'/images/999'),404);
 ok(await call(b.token,'POST','/reviews/'+r.id+'/images',upload()),404);
 ok(await call(a.token,'POST','/reviews/'+r.id+'/images',upload(4)),400);
 ok(await call(a.token,'POST','/reviews/'+r.id+'/images',upload(1,Buffer.from('<svg onload="bad">'))),400);
 ok(await call(a.token,'POST','/reviews/'+r.id+'/images',upload(1,Buffer.alloc(5*1024*1024+1))),400);
 const imageRace=await Promise.all([call(a.token,'POST','/reviews/'+r.id+'/images',upload(2)),call(a.token,'POST','/reviews/'+r.id+'/images',upload(2))]);
 assert.deepEqual(imageRace.map(x=>x.status).sort(),[200,400]);
 const image=imageRace.find(x=>x.status===200).data.images[0];
 assert.equal((await fetch(base+image.imageUrl)).status,200);
 ok(await call(a.token,'DELETE','/reviews/'+r.id+'/images/'+image.id),204);
 assert.equal((await fetch(base+image.imageUrl)).status,404);
 const rb=ok(await call(b.token,'POST',path,{rating:2,content:'Second review'}));
 const rc=ok(await call(c.token,'POST',path,{rating:5,content:'Third review'}));
 ok(await call(a.token,'PUT','/reviews/'+r.id+'/helpful'),400);
 const votes=await Promise.all([call(b.token,'PUT','/reviews/'+r.id+'/helpful'),call(b.token,'PUT','/reviews/'+r.id+'/helpful')]);
 votes.forEach(v=>assert.equal(ok(v).helpfulCount,1));
 assert.equal(ok(await call(b.token,'DELETE','/reviews/'+r.id+'/helpful')).helpfulCount,0);
 ok(await call(b.token,'PUT','/reviews/'+r.id+'/helpful'));
 const summary=ok(await call(null,'GET',path));assert.equal(summary.totalVisible,3);assert.equal(summary.averageRating,11/3);
 assert.equal(JSON.stringify(summary).includes('email'),false);
 assert.equal(ok(await call(null,'GET',path+'?sort=newest')).items[0].id,rc.id);
 assert.equal(ok(await call(null,'GET',path+'?sort=highest')).items[0].id,rc.id);
 assert.equal(ok(await call(null,'GET',path+'?sort=lowest')).items[0].id,rb.id);
 assert.equal(ok(await call(null,'GET',path+'?sort=helpful')).items[0].id,r.id);
 assert.equal(ok(await call(null,'GET',path+'?rating=2')).total,1);
 assert.equal(ok(await call(null,'GET',path+'?pageSize=1&page=2')).items.length,1);
 ok(await call(null,'GET',path+'?pageSize=1000'),400);
 const top=ok(await call(null,'GET','/products/top-rated'));assert.ok(top.every(x=>x.reviewCount>=3));
 const expectedTop=sql(`SELECT TOP(4) p.Id FROM Products p JOIN Categories c ON c.Id=p.CategoryId
 LEFT JOIN Categories parent ON parent.Id=c.ParentId LEFT JOIN Categories grand ON grand.Id=parent.ParentId
 JOIN ProductReviews r ON r.ProductId=p.Id AND r.IsVisible=1
 WHERE p.IsActive=1 AND c.IsActive=1 AND (parent.Id IS NULL OR (parent.IsActive=1 AND (grand.Id IS NULL OR (grand.IsActive=1 AND grand.ParentId IS NULL))))
 GROUP BY p.Id HAVING COUNT(*)>=3 ORDER BY AVG(CONVERT(float,r.Rating)) DESC,COUNT(*) DESC,p.Id`).split(/\s+/).filter(Boolean).map(Number);
 assert.deepEqual(top.map(x=>x.product.id),expectedTop);
 ok(await call(a.token,'PUT','/admin/reviews/'+r.id+'/visibility',{isVisible:false}),403);
 ok(await call(admin.token,'PUT','/admin/reviews/'+r.id+'/visibility',{isVisible:false}),204);
 const hidden=ok(await call(null,'GET',path));assert.equal(hidden.totalVisible,2);assert.equal(hidden.averageRating,3.5);
 ok(await call(b.token,'PUT','/reviews/'+r.id+'/helpful'),404);
 assert.equal(num(`SELECT COUNT(*) FROM ProductReviews WHERE Id=${r.id}`),1);
 const remainingImage=ok(await call(a.token,'GET',path+'/me')).review.images[0];
 assert.equal((await fetch(base+remainingImage.imageUrl)).status,404);
 assert.equal((await fetch(base+remainingImage.imageUrl,{headers:{Authorization:'Bearer '+a.token}})).status,200);
 ok(await call(a.token,'PUT',path+'/me',{rating:3,content:'Still hidden'}));
 assert.equal(ok(await call(null,'GET',path)).totalVisible,2);
 ok(await call(admin.token,'PUT','/admin/reviews/'+r.id+'/visibility',{isVisible:true}),204);
 purchased(a,inactive);sql(`UPDATE Products SET IsActive=0 WHERE Id=${inactive}`);
 assert.equal(ok(await call(a.token,'GET','/products/'+inactive+'/reviews/me')).canReview,true);
 const ir=ok(await call(a.token,'POST','/products/'+inactive+'/reviews',{rating:4,content:'Historical purchase'}));assert.equal(ir.verifiedPurchase,true);
 ok(await call(null,'GET','/products/'+inactive+'/reviews'),404);
 assert.ok(!ok(await call(null,'GET','/products/'+p+'/related')).some(x=>x.id===p||x.id===inactive));
 assert.deepEqual(ok(await call(null,'GET','/products/recent?ids='+inactive+','+p)).map(x=>x.id),[p]);
 const q=ok(await call(a.token,'POST','/products/'+p+'/questions',{content:'Where is it from?'}));
 ok(await call(a.token,'PUT','/admin/questions/'+q.id+'/answer',{content:'Fake staff'}),403);
 ok(await call(admin.token,'PUT','/admin/questions/'+q.id+'/answer',{content:'Verified origin in certificate'}),204);
 assert.equal(ok(await call(null,'GET','/products/'+p+'/questions')).items[0].answer.content,'Verified origin in certificate');
 ok(await call(admin.token,'PUT','/admin/questions/'+q.id+'/visibility',{isVisible:false}),204);
 assert.equal(ok(await call(null,'GET','/products/'+p+'/questions')).total,0);
 ok(await call(a.token,'GET','/admin/reviews/analytics'),403);
 assert.ok(ok(await call(admin.token,'GET','/admin/reviews/analytics')).totalVisible>=4);
 sql(`UPDATE Users SET IsActive=0 WHERE Id=${a.id}`);
 ok(await call(a.token,'GET',path+'/me'),401);
 sql(`UPDATE Users SET IsActive=1 WHERE Id=${a.id}`);
 // Delete remaining files via the real ownership API before fixture SQL cleanup.
 const own=ok(await call(a.token,'GET',path+'/me')).review;
 for(const image of own.images)ok(await call(a.token,'DELETE','/reviews/'+r.id+'/images/'+image.id),204);
 console.log('PASS reviews: purchase/auth, concurrency, edit, images, hidden privacy, votes, pagination/sorts, inactive history, Q&A, recommendations, analytics.');
}finally{
 if(users.length){
 const ids=users.join(',');
 sql(`DELETE ReviewHelpfulVotes WHERE UserId IN (${ids}) OR ReviewId IN(SELECT Id FROM ProductReviews WHERE UserId IN(${ids}));
 DELETE ReviewImages WHERE ReviewId IN(SELECT Id FROM ProductReviews WHERE UserId IN(${ids}));
 DELETE ProductReviews WHERE UserId IN(${ids});
 DELETE ProductAnswers WHERE QuestionId IN(SELECT Id FROM ProductQuestions WHERE UserId IN(${ids}));
 DELETE ProductQuestions WHERE UserId IN(${ids});
 DELETE CheckoutReceipts WHERE UserId IN(${ids});
 DELETE OrderDetails WHERE OrderId IN(SELECT Id FROM Orders WHERE UserId IN(${ids}));
 DELETE Orders WHERE UserId IN(${ids});
 DELETE CartItems WHERE CartId IN(SELECT Id FROM Carts WHERE UserId IN(${ids}));
 DELETE Carts WHERE UserId IN(${ids}); DELETE Users WHERE Id IN(${ids});`);
 }
 if(products.length)sql(`DELETE Products WHERE Id IN(${products.join(',')}) AND Name LIKE '${tag}%'`);
 if(category)sql(`DELETE Categories WHERE Id=${category} AND Name='${tag}'`);
 console.log('Temporary review fixtures cleaned.');
}
