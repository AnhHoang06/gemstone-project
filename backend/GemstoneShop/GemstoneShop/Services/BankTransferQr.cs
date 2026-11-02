using System.Globalization;
using System.Text.RegularExpressions;
using QRCoder;

namespace GemstoneShop.Services;

/// <summary>Local NAPAS account-transfer TLV payload; never verifies receipt of money.</summary>
public static class BankTransferQr
{
    public static bool ValidAccount(string? bin, string? account) =>
        bin != null && Regex.IsMatch(bin, "^[0-9]{6}$") &&
        account != null && Regex.IsMatch(account, "^[A-Za-z0-9]{1,19}$");

    public static string? Payload(string? bin, string? account, decimal amount, int orderId)
    {
        // VND orders must have an exact positive whole-dong amount; never round a payment.
        var value = amount.ToString("0.############################", CultureInfo.InvariantCulture);
        if (!ValidAccount(bin, account) || amount <= 0 || amount != decimal.Truncate(amount) || value.Length > 13 || orderId <= 0)
            return null;
        static string Tlv(string id, string data) => id + data.Length.ToString("D2", CultureInfo.InvariantCulture) + data;
        var beneficiary = Tlv("00", bin!) + Tlv("01", account!);
        var merchant = Tlv("00", "A000000727") + Tlv("01", beneficiary) + Tlv("02", "QRIBFTTA");
        var content = "DH" + orderId.ToString(CultureInfo.InvariantCulture);
        var body = Tlv("00", "01") + Tlv("01", "12") + Tlv("38", merchant) +
            Tlv("53", "704") + Tlv("54", value) + Tlv("58", "VN") + Tlv("62", Tlv("08", content)) + "6304";
        ushort crc = 0xFFFF;
        foreach (var c in body)
        {
            crc ^= (ushort)(c << 8);
            for (var bit = 0; bit < 8; bit++) crc = (ushort)((crc & 0x8000) != 0 ? (crc << 1) ^ 0x1021 : crc << 1);
        }
        return body + crc.ToString("X4", CultureInfo.InvariantCulture);
    }

    public static string Image(string payload) => "data:image/png;base64," + Convert.ToBase64String(
        PngByteQRCodeHelper.GetQRCode(payload, QRCodeGenerator.ECCLevel.M, 6));
}
