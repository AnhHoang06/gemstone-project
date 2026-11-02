import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({get:vi.fn(),put:vi.fn()}));
vi.mock('../api/api',()=>({default:mocks}));
import OrderDetailView from './OrderDetailView';
import { CommerceContext } from './context';
import { saveSession } from '../auth/session';
let order;
beforeEach(()=>{
  vi.resetAllMocks(); saveSession({token:'A',role:'Customer',fullName:'A'});
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  order={id:52,status:'Pending',recipientName:'Original Name',recipientPhone:'0901234567',shippingAddress:'Original address',note:'Original note',paymentMethod:'COD',paymentStatus:'Unpaid',createdAt:'2026-11-01T00:00:00Z',totalAmount:1000000,items:[]};
  mocks.get.mockImplementation(async()=>({data:structuredClone(order)}));
});
afterEach(()=>{cleanup();localStorage.clear();delete HTMLDialogElement.prototype.showModal;delete HTMLDialogElement.prototype.close;});
async function mount(admin=false){await act(async()=>render(<MemoryRouter initialEntries={['/orders/52']}><CommerceContext.Provider value={{token:'A',revision:0,refreshCart:vi.fn()}}><Routes><Route path="/orders/:id" element={<OrderDetailView admin={admin}/>}/></Routes></CommerceContext.Provider></MemoryRouter>));}
const open=()=>{fireEvent.click(screen.getByRole('button',{name:'Chỉnh sửa thông tin giao hàng'}));return within(screen.getByRole('dialog'));};
it.each([false,true].flatMap(admin=>['Pending','Confirmed','Shipping','Completed','Cancelled'].map(status=>({admin,status}))))('eligibility: admin=$admin status=$status',async({admin,status})=>{
  order.status=status; await mount(admin);
  expect(Boolean(screen.queryByRole('button',{name:'Chỉnh sửa thông tin giao hàng'}))).toBe(['Pending','Confirmed'].includes(status));
});
it('prefills the order snapshot and cancelling creates no request',async()=>{
  await mount(); const dialog=open();
  expect(dialog.getByLabelText('Người nhận').value).toBe('Original Name');
  expect(dialog.getByLabelText('Số điện thoại').value).toBe('0901234567');
  expect(dialog.getByLabelText('Địa chỉ giao hàng').value).toBe('Original address');
  expect(dialog.getByLabelText('Ghi chú').value).toBe('Original note');
  fireEvent.change(dialog.getByLabelText('Địa chỉ giao hàng'),{target:{value:'Unsubmitted'}});
  fireEvent.click(dialog.getByRole('button',{name:'Hủy'}));
  expect(screen.queryByRole('dialog')).toBeNull(); expect(mocks.put).not.toHaveBeenCalled();
  expect(screen.getByText('Original address')).toBeTruthy();
});
it('inline validation rejects empty required fields/invalid phone, clears corrected error and disables native bubbles',async()=>{
  await mount();const dialog=open();
  for(const label of ['Người nhận','Địa chỉ giao hàng'])fireEvent.change(dialog.getByLabelText(label),{target:{value:' '}});
  fireEvent.change(dialog.getByLabelText('Số điện thoại'),{target:{value:'abc'}});
  fireEvent.click(dialog.getByRole('button',{name:'Lưu thay đổi'}));
  expect(dialog.getByText('Số điện thoại không hợp lệ.')).toBeTruthy();
  expect(dialog.getByLabelText('Người nhận').getAttribute('aria-invalid')).toBe('true');
  expect(dialog.getByLabelText('Người nhận').getAttribute('aria-describedby')).toBe('shipping-recipientName-error');
  expect(dialog.getByLabelText('Người nhận').closest('form').noValidate).toBe(true);
  fireEvent.change(dialog.getByLabelText('Người nhận'),{target:{value:'Correct'}});
  expect(dialog.getByLabelText('Người nhận').getAttribute('aria-invalid')).toBe('false');
  expect(mocks.put).not.toHaveBeenCalled();
});
it.each([false,true])('saves only four fields, prevents duplicates, refetches and shows success (admin=%s)',async admin=>{
  order.status='Confirmed';await mount(admin);const dialog=open();let finish;
  mocks.put.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  fireEvent.change(dialog.getByLabelText('Địa chỉ giao hàng'),{target:{value:'  Updated address  '}});
  const button=dialog.getByRole('button',{name:'Lưu thay đổi'});fireEvent.click(button);fireEvent.click(button);
  expect(mocks.put).toHaveBeenCalledTimes(1);expect(button.disabled).toBe(true);expect(dialog.getByRole('button',{name:'Hủy'}).disabled).toBe(true);
  expect(mocks.put).toHaveBeenCalledWith(`/orders/${admin?'admin/':''}52/shipping-info`,{recipientName:'Original Name',recipientPhone:'0901234567',shippingAddress:'Updated address',note:'Original note'});
  await act(async()=>{order.shippingAddress='Updated address';finish({data:{id:52}});});
  expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByText('Updated address')).toBeTruthy();
  expect(screen.getByText('Đã cập nhật thông tin giao hàng')).toBeTruthy();
});
it('stale Shipping conflict stays visible, refetches and blocks retries',async()=>{
  order.status='Confirmed';await mount();const dialog=open();
  mocks.put.mockImplementation(async()=>{order.status='Shipping';throw {response:{status:409,data:{message:'Đơn hàng đã chuyển sang giai đoạn giao hàng và không thể chỉnh sửa thông tin giao nhận.'}}};});
  await act(async()=>fireEvent.click(dialog.getByRole('button',{name:'Lưu thay đổi'})));
  expect(dialog.getByRole('alert').textContent).toContain('giai đoạn giao hàng');expect(dialog.getByRole('button',{name:'Lưu thay đổi'}).disabled).toBe(true);
  expect(screen.queryByText('Đã cập nhật thông tin giao hàng')).toBeNull();
  fireEvent.click(dialog.getByRole('button',{name:'Hủy'}));expect(screen.queryByRole('button',{name:'Chỉnh sửa thông tin giao hàng'})).toBeNull();
});
it('server validation remains authoritative and preserves the draft',async()=>{
  await mount();const dialog=open();mocks.put.mockRejectedValue({response:{status:400,data:{errors:{RecipientPhone:['Số điện thoại không hợp lệ.']}}}});
  await act(async()=>fireEvent.click(dialog.getByRole('button',{name:'Lưu thay đổi'})));
  expect(dialog.getByLabelText('Số điện thoại').getAttribute('aria-invalid')).toBe('true');
  expect(dialog.getByLabelText('Địa chỉ giao hàng').value).toBe('Original address');expect(dialog.getByRole('button',{name:'Lưu thay đổi'}).disabled).toBe(false);
});
it('does not report success or refetch for a previous session response',async()=>{
  await mount();const dialog=open();let finish;mocks.put.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  fireEvent.click(dialog.getByRole('button',{name:'Lưu thay đổi'}));const before=mocks.get.mock.calls.length;
  saveSession({token:'B',role:'Customer',fullName:'B'});await act(async()=>finish({data:{id:52}}));
  expect(mocks.get).toHaveBeenCalledTimes(before);expect(screen.queryByText('Đã cập nhật thông tin giao hàng')).toBeNull();
});

it('network failure preserves edited input and allows retry without a success toast',async()=>{
  await mount();const dialog=open();mocks.put.mockRejectedValue(new Error('offline'));
  fireEvent.change(dialog.getByLabelText('Địa chỉ giao hàng'),{target:{value:'Keep my draft'}});
  await act(async()=>fireEvent.click(dialog.getByRole('button',{name:'Lưu thay đổi'})));
  expect(dialog.getByRole('alert').textContent).toContain('Không cập nhật được');
  expect(dialog.getByLabelText('Địa chỉ giao hàng').value).toBe('Keep my draft');
  expect(dialog.getByRole('button',{name:'Lưu thay đổi'}).disabled).toBe(false);
  expect(screen.queryByText('Đã cập nhật thông tin giao hàng')).toBeNull();
});
