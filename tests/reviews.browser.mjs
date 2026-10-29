// Optional browser smoke checks. Requires local ReviewSampleData.sql and a running frontend/API.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PERSON3_API_URL||'http://localhost:5121',front=process.env.REVIEWS_FRONTEND_URL||'http://localhost:2222';
for(const url of[base,front])if(!['localhost','127.0.0.1'].includes(new URL(url).hostname))throw Error('Local only');
const sql=q=>execFileSync('sqlcmd',['-S',process.env.PERSON3_SQL_SERVER||'.'+String.fromCharCode(92)+'SQLEXPRESS','-d',process.env.PERSON3_SQL_DATABASE||'GemstoneShop','-E','-C','-b','-h','-1','-W','-Q','SET NOCOUNT ON; '+q],{encoding:'utf8'}).trim();
const p=Number(sql("SELECT MIN(Id) FROM Products WHERE Description=N'ReviewDemo_v1:product'"));
assert.ok(p>0,'Run optional ReviewSampleData.sql first');
const tag='review-browser-'+randomUUID(),users=[];
async function request(token,method,path,body){
 const r=await fetch(base+'/api'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 assert.ok(r.ok,await r.clone().text());return r.status===204?null:r.json();
}
async function user(admin=false){
 const email=tag+'-'+users.length+'@example.invalid',password=randomUUID()+'aA1!';
 await request(null,'POST','/auth/register',{fullName:admin?'Quản trị kiểm tra':'Khách kiểm tra',email,password});
 const id=Number(sql(`SELECT Id FROM Users WHERE Email='${email}'`));users.push(id);
 if(admin)sql(`UPDATE Users SET RoleId=(SELECT Id FROM Roles WHERE Name='Admin') WHERE Id=${id}`);
 return{id,...await request(null,'POST','/auth/login',{email,password})};
}
let browser;
try{
 const a=await user(),b=await user(),admin=await user(true);
 browser=await chromium.launch({channel:'msedge',headless:true});
 const errors=[];
 async function pageFor(user){
  const page=await browser.newPage({viewport:{width:1366,height:900}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(u=>{for(const key of['token','role','fullName'])localStorage.setItem(key,u[key]);},user);
  return page;
 }
 const page=await pageFor(a);
 await page.goto(front+'/product/'+p);await page.getByText('Chỉ khách hàng có đơn Hoàn tất chứa sản phẩm này mới được đánh giá.').waitFor();
 sql(`INSERT Orders(UserId,StatusId,RecipientName,RecipientPhone,ShippingAddress,TotalAmount,Note,CreatedAt,PaymentMethod,PaymentStatus,PaidAt)
 SELECT ${a.id},Id,N'Khách kiểm tra','0000000000',N'Tạm',1000000,N'${tag}',SYSUTCDATETIME(),'COD','Paid',SYSUTCDATETIME() FROM OrderStatuses WHERE Name='Completed';
 DECLARE @id int=CONVERT(int,SCOPE_IDENTITY());INSERT OrderDetails(OrderId,ProductId,ProductName,Quantity,UnitPrice)VALUES(@id,${p},N'Đá kiểm tra',1,1000000);`);
 await page.reload();await page.getByLabel('5 ★',{exact:true}).check();await page.getByLabel('Nội dung',{exact:true}).fill('Đá có màu đẹp, đúng kích thước mô tả.');
 await page.getByRole('button',{name:'Gửi đánh giá',exact:true}).click();await page.getByText('Đã lưu đánh giá.',{exact:true}).waitFor();
 const r=(await request(a.token,'GET','/products/'+p+'/reviews/me')).review;
 assert.ok(r.verifiedPurchase);
 await page.getByLabel('Nội dung',{exact:true}).fill('Đã kiểm tra kỹ, màu đá đẹp và tự nhiên.');
 await page.getByRole('button',{name:'Cập nhật đánh giá',exact:true}).click();
 await page.locator('.review-card').filter({hasText:'Đã kiểm tra kỹ, màu đá đẹp và tự nhiên.'}).waitFor();
 assert.equal((await request(a.token,'GET','/products/'+p+'/reviews/me')).review.id,r.id);
 const other=await pageFor(b);await other.goto(front+'/product/'+p);
 const card=other.locator('.review-card').filter({hasText:'Đã kiểm tra kỹ, màu đá đẹp và tự nhiên.'});
 await card.getByRole('button',{name:'Hữu ích (0)',exact:true}).click();await card.getByRole('button',{name:'Hữu ích (1)',exact:true}).waitFor();
 await page.getByLabel('Câu hỏi',{exact:true}).fill('Có hướng dẫn bảo quản đá không?');
 await page.getByRole('button',{name:'Gửi câu hỏi',exact:true}).click();await page.locator('.review-card').filter({hasText:'Có hướng dẫn bảo quản đá không?'}).waitFor();
 const ap=await pageFor(admin);await ap.goto(front+'/admin/reviews');
 const row=ap.locator('tr').filter({hasText:'Đã kiểm tra kỹ, màu đá đẹp và tự nhiên.'});
 await row.getByRole('button',{name:'Ẩn',exact:true}).click();await row.getByRole('button',{name:'Khôi phục',exact:true}).waitFor();
 await other.reload();await other.getByLabel('Số sao',{exact:true}).waitFor();
 await other.getByText('Đang tải đánh giá…').waitFor({state:'hidden'});
 assert.equal(await other.getByText('Đã kiểm tra kỹ, màu đá đẹp và tự nhiên.',{exact:true}).count(),0);
 await row.getByRole('button',{name:'Khôi phục',exact:true}).click();
 await ap.getByRole('button',{name:'Hỏi đáp',exact:true}).click();
 const qrow=ap.locator('tr').filter({hasText:'Có hướng dẫn bảo quản đá không?'});
 await qrow.getByRole('textbox').fill('Tránh va đập và lau nhẹ bằng khăn mềm.');
 await qrow.getByRole('button',{name:'Trả lời',exact:true}).click();await qrow.getByRole('button',{name:'Cập nhật phản hồi',exact:true}).waitFor();
 await ap.getByRole('button',{name:'Thống kê đánh giá',exact:true}).click();await ap.getByText('Điểm cao nhất',{exact:true}).waitFor();
 mkdirSync('docs/reviews',{recursive:true});await ap.screenshot({path:'docs/reviews/admin-analytics.png',fullPage:true});
 await page.reload();await page.locator('#reviews .review-card').first().waitFor();await page.locator('#reviews').screenshot({path:'docs/reviews/reviews-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('#reviews').screenshot({path:'docs/reviews/reviews-mobile.png'});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile overflow');
 const order=Number(sql(`SELECT Id FROM Orders WHERE UserId=${a.id}`));
 await page.goto(front+'/orders/'+order);await page.getByRole('link',{name:'Xem / sửa đánh giá',exact:true}).click();await page.getByRole('button',{name:'Cập nhật đánh giá',exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS browser: no purchase/Completed review, edit, helpful, hide/restore, Q&A answer, analytics, order CTA, desktop/mobile.');
}catch(error){
 for(const context of browser?.contexts()||[])for(const page of context.pages())console.log('Browser failure URL:',page.url());
 throw error;
}finally{
 await browser?.close();
 if(users.length){const ids=users.join(',');sql(`DELETE ReviewHelpfulVotes WHERE UserId IN(${ids}) OR ReviewId IN(SELECT Id FROM ProductReviews WHERE UserId IN(${ids}));
 DELETE ReviewImages WHERE ReviewId IN(SELECT Id FROM ProductReviews WHERE UserId IN(${ids}));
 DELETE ProductReviews WHERE UserId IN(${ids});
 DELETE ProductAnswers WHERE QuestionId IN(SELECT Id FROM ProductQuestions WHERE UserId IN(${ids}));
 DELETE ProductQuestions WHERE UserId IN(${ids});
 DELETE CheckoutReceipts WHERE UserId IN(${ids});DELETE OrderDetails WHERE OrderId IN(SELECT Id FROM Orders WHERE UserId IN(${ids}));
 DELETE Orders WHERE UserId IN(${ids});DELETE CartItems WHERE CartId IN(SELECT Id FROM Carts WHERE UserId IN(${ids}));
 DELETE Carts WHERE UserId IN(${ids});DELETE Users WHERE Id IN(${ids});`);}
 console.log('Browser fixtures cleaned.');
}
