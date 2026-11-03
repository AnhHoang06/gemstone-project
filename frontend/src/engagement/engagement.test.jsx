import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ReviewSummary from './ReviewSummary';
import ReviewForm from './ReviewForm';
import ProductReviews from './ProductReviews';
import ProductQuestions from './ProductQuestions';
import { RelatedProducts, RecentlyViewed, TopRatedProducts, LowStock } from './ProductShelves';
import { recordRecent, readRecent } from './recent';
import { OrderReviewLink } from './OrderReview';
import { saveSession, clearSession } from '../auth/session';
const api=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),put:vi.fn(),delete:vi.fn()}));
vi.mock('../api/api',()=>({default:api}));
vi.mock('../components/ProductCard',()=>({default:({product})=><div>{product.name}</div>}));
const review={id:10,productId:1,productName:'Ruby',customerName:'Khách hàng',rating:4,content:'Đá đẹp',isVisible:true,verifiedPurchase:true,helpfulCount:2,helpfulByMe:false,isOwn:false,images:[],createdAt:'2026-10-01T00:00:00Z'};
const summary={items:[review],total:1,totalPages:1,totalVisible:1,averageRating:4,ratingDistribution:[{rating:4,count:1}]};
const wrap=ui=>render(<MemoryRouter>{ui}</MemoryRouter>);
beforeEach(()=>{vi.resetAllMocks();localStorage.clear();sessionStorage.clear();api.get.mockResolvedValue({data:summary});api.post.mockResolvedValue({data:review});api.put.mockResolvedValue({data:review});api.delete.mockResolvedValue({});});
afterEach(cleanup);
describe('Reviews UI',()=>{
 it('shows real average, count and accessible distribution',()=>{
  render(<ReviewSummary data={summary}/>);expect(screen.getByText('4.0 / 5')).toBeTruthy();expect(screen.getByText('1 đánh giá')).toBeTruthy();
  expect(screen.getByRole('meter',{name:'4 sao: 1 đánh giá'}).getAttribute('value')).toBe('1');
 });
 it('validates then creates review from selected rating and content',async()=>{
  const saved=vi.fn();render(<ReviewForm productId={1} onSaved={saved}/>);
  fireEvent.click(screen.getByText('Gửi đánh giá'));expect(api.post).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toBeTruthy();
  fireEvent.click(screen.getByLabelText('5 ★'));fireEvent.change(screen.getByLabelText('Nội dung'),{target:{value:'Màu đá đẹp'}});
  fireEvent.click(screen.getByText('Gửi đánh giá'));
  await waitFor(()=>expect(saved).toHaveBeenCalled());expect(api.post).toHaveBeenCalledWith('/products/1/reviews',{rating:5,content:'Màu đá đẹp'});
 });
 it('edits existing review, keeping hidden moderation notice',async()=>{
  render(<ReviewForm productId={1} initialReview={{...review,isVisible:false}} onSaved={()=>{}}/>);
  expect(screen.getByText(/không tự khôi phục/)).toBeTruthy();fireEvent.change(screen.getByLabelText('Nội dung'),{target:{value:'Đã sửa'}});
  fireEvent.click(screen.getByText('Cập nhật đánh giá'));await waitFor(()=>expect(api.put).toHaveBeenCalledWith('/products/1/reviews/me',{rating:4,content:'Đã sửa'}));expect(api.post).not.toHaveBeenCalled();
 });
 it('previews and removes selected images, rejects more than three',async()=>{
  render(<ReviewForm productId={1} onSaved={()=>{}}/>);
  const input=screen.getByLabelText(/Ảnh \(tùy chọn/),file=new File(['image'],'stone.png',{type:'image/png'});
  fireEvent.change(input,{target:{files:[file]}});
  expect(await screen.findByAltText('Ảnh chờ tải: stone.png')).toBeTruthy();
  fireEvent.click(screen.getByText('Bỏ ảnh đã chọn'));expect(screen.queryByAltText('Ảnh chờ tải: stone.png')).toBeNull();
  fireEvent.change(input,{target:{files:[file,file,file,file]}});expect(screen.getByRole('alert').textContent).toContain('tối đa 3');
 });
 it('deletes owned existing image through the ownership endpoint',async()=>{
  api.get.mockRejectedValue(new Error('unavailable'));
  render(<ReviewForm productId={1} initialReview={{...review,images:[{id:8}]}} onSaved={()=>{}}/>);
  fireEvent.click(screen.getByText('Xóa ảnh'));await waitFor(()=>expect(api.delete).toHaveBeenCalledWith('/reviews/10/images/8'));
  await waitFor(()=>expect(screen.queryByText('Xóa ảnh')).toBeNull());
 });
 it('server-side sort/rating query changes; hidden cards never render',async()=>{
  api.get.mockResolvedValue({data:{...summary,items:[review,{...review,id:11,isVisible:false,content:'Hidden secret'}]}});
  wrap(<ProductReviews productId={1}/>);expect(await screen.findByText('Đá đẹp')).toBeTruthy();expect(screen.queryByText('Hidden secret')).toBeNull();
  fireEvent.change(screen.getByLabelText('Số sao'),{target:{value:'5'}});fireEvent.change(screen.getByLabelText('Sắp xếp'),{target:{value:'helpful'}});
  await waitFor(()=>expect(api.get).toHaveBeenCalledWith(expect.stringContaining('rating=5&sort=helpful')));
 });
 it('helpful action uses current server state and reloads list',async()=>{
  localStorage.setItem('token','a');localStorage.setItem('role','Admin');
  wrap(<ProductReviews productId={1}/>);fireEvent.click(await screen.findByRole('button',{name:'Hữu ích (2)'}));
  await waitFor(()=>expect(api.put).toHaveBeenCalledWith('/reviews/10/helpful'));
  await waitFor(()=>expect(api.get).toHaveBeenCalledWith(expect.stringContaining('v=1')));
 });
 it('already helpful sends DELETE; failure has an inline error',async()=>{
  localStorage.setItem('token','a');localStorage.setItem('role','Admin');
  api.get.mockResolvedValue({data:{...summary,items:[{...review,helpfulByMe:true}]}});
  api.delete.mockRejectedValue(new Error('offline'));
  wrap(<ProductReviews productId={1}/>);fireEvent.click(await screen.findByRole('button',{name:'Hữu ích (2)'}));
  expect(await screen.findByRole('alert')).toBeTruthy();expect(api.delete).toHaveBeenCalledWith('/reviews/10/helpful');
 });
 it('shows loading, error and empty data distinctly',async()=>{
  api.get.mockRejectedValue(new Error('offline'));const view=wrap(<ProductReviews productId={1}/>);
  expect(screen.getByRole('status')).toBeTruthy();expect(await screen.findByRole('alert')).toBeTruthy();view.unmount();
  api.get.mockResolvedValue({data:{...summary,items:[],total:0,totalVisible:0}});
  wrap(<ProductReviews productId={2}/>);expect(await screen.findByText('Chưa có đánh giá phù hợp.')).toBeTruthy();
 });
 it('clears private review form on logout and ignores a late prior-session response',async()=>{
  localStorage.setItem('token','a');localStorage.setItem('role','Customer');let resolve;
  api.get.mockImplementation(path=>path.endsWith('/me')?new Promise(r=>{resolve=r;}):Promise.resolve({data:summary}));
  wrap(<ProductReviews productId={1}/>);await waitFor(()=>expect(resolve).toBeTruthy());
  act(()=>clearSession());await act(async()=>resolve({data:{canReview:true,review:{...review,content:'Private old session'}}}));
  expect(screen.queryByDisplayValue('Private old session')).toBeNull();
 });
});
describe('Engagement integration UI',()=>{
 it('customer asks Q&A and sees real admin answer',async()=>{
  localStorage.setItem('token','a');localStorage.setItem('role','Customer');
  api.get.mockResolvedValue({data:{total:1,items:[{id:1,customerName:'Khách',content:'Xuất xứ?',createdAt:'2026-10-01',answer:{content:'Sri Lanka',createdAt:'2026-10-02'}}]}});
  wrap(<ProductQuestions productId={1}/>);expect(await screen.findByText('Sri Lanka')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Câu hỏi'),{target:{value:'Có chứng nhận không?'}});fireEvent.click(screen.getByText('Gửi câu hỏi'));
  await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/products/1/questions',{content:'Có chứng nhận không?'}));
 });
 it('order CTA identifies an existing review',async()=>{
  api.get.mockResolvedValue({data:{canReview:true,review}});
  wrap(<OrderReviewLink productId={1}/>);expect((await screen.findByText('Xem / sửa đánh giá')).getAttribute('href')).toBe('/review-product/1');
 });
 it('related and top-rated use real API; insufficient reviews has honest fallback',async()=>{
  api.get.mockImplementation(path=>Promise.resolve({data:path.includes('related')?[{id:2,name:'Sapphire'}]:[]}));
  wrap(<><RelatedProducts productId={1}/><TopRatedProducts/></>);
  expect(await screen.findByText('Sapphire')).toBeTruthy();expect(await screen.findByText('Chưa đủ đánh giá để xếp hạng sản phẩm.')).toBeTruthy();
 });
 it('recent IDs are bounded/deduplicated, visibility is resolved by API, session switches clear history',async()=>{
  for(let n=1;n<16;n++)recordRecent(n);recordRecent(12);expect(readRecent()).toHaveLength(12);expect(readRecent()[0]).toBe(12);
  api.get.mockResolvedValue({data:[{id:12,name:'Visible gemstone'},{id:20,name:'Current'}]});
  wrap(<RecentlyViewed productId={20}/>);expect(await screen.findByText('Visible gemstone')).toBeTruthy();expect(screen.queryByText('Current')).toBeNull();
  expect(readRecent()).toEqual([12,20]);act(()=>saveSession({token:'new',role:'Customer',fullName:'New account'}));
  // Only the currently open public product may be recorded again after remount.
  expect(readRecent()).toEqual([20]);
 });
 it('low stock shows only actual positive stock up to 3',()=>{
  const view=render(<LowStock stock={2}/>);expect(screen.getByText('Còn 2 sản phẩm')).toBeTruthy();
  view.rerender(<LowStock stock={0}/>);expect(screen.queryByText(/Còn/)).toBeNull();view.rerender(<LowStock stock={4}/>);expect(screen.queryByText(/Còn/)).toBeNull();
 });
});
