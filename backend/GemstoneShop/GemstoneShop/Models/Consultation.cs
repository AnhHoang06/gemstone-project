namespace GemstoneShop.Models;

// Extensions to the database-first model; persisted by Database/Consultation.sql.
public class ConsultationService
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public int DurationMinutes { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class ConsultationHour
{
    /// <summary>0 = Sunday ... 6 = Saturday (System.DayOfWeek numbering).</summary>
    public byte DayOfWeek { get; set; }
    public bool IsOpen { get; set; }
    public TimeOnly OpenTime { get; set; }
    public TimeOnly CloseTime { get; set; }
    public int SlotMinutes { get; set; }
    public int CapacityPerSlot { get; set; }
}

public class ConsultationClosedDate
{
    public DateOnly Date { get; set; }
    public string? Reason { get; set; }
}

public static class AppointmentStatus
{
    public const string Pending = "Pending", Confirmed = "Confirmed", Completed = "Completed", Cancelled = "Cancelled", NoShow = "NoShow";
    public static bool IsValid(string? value) => value is Pending or Confirmed or Completed or Cancelled or NoShow;
}

public class Appointment
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int ServiceId { get; set; }
    public string ServiceName { get; set; } = "";
    public decimal Price { get; set; }
    /// <summary>Store-local time (Asia/Ho_Chi_Minh), no offset.</summary>
    public DateTime StartAt { get; set; }
    /// <summary>Store-local time (Asia/Ho_Chi_Minh), no offset.</summary>
    public DateTime EndAt { get; set; }
    public string Status { get; set; } = AppointmentStatus.Pending;
    public string ContactName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string? Note { get; set; }
    public string? CancelReason { get; set; }
    public string? CancelledBy { get; set; }
    public Guid RequestId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public User User { get; set; } = null!;
    public ConsultationService Service { get; set; } = null!;
}
