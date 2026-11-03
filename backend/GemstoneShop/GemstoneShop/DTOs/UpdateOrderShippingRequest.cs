using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace GemstoneShop.DTOs;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public class UpdateOrderShippingRequest
{
    private string? name, phone, address, note;
    [Required(ErrorMessage = "Vui lòng nhập tên người nhận."), StringLength(100, ErrorMessage = "Tên người nhận tối đa 100 ký tự.")]
    public string? RecipientName { get => name; set => name = value?.Trim(); }
    [Required(ErrorMessage = "Vui lòng nhập số điện thoại."), StringLength(20, ErrorMessage = "Số điện thoại tối đa 20 ký tự."), Phone(ErrorMessage = "Số điện thoại không hợp lệ.")]
    public string? RecipientPhone { get => phone; set => phone = value?.Trim(); }
    [Required(ErrorMessage = "Vui lòng nhập địa chỉ giao hàng."), StringLength(500, ErrorMessage = "Địa chỉ giao hàng tối đa 500 ký tự.")]
    public string? ShippingAddress { get => address; set => address = value?.Trim(); }
    [StringLength(500, ErrorMessage = "Ghi chú tối đa 500 ký tự.")]
    public string? Note { get => note; set => note = string.IsNullOrWhiteSpace(value) ? null : value.Trim(); }
}
