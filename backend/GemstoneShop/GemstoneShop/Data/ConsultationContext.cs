using GemstoneShop.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace GemstoneShop.Data;

public partial class GemstoneShopContext
{
    public DbSet<ConsultationService> ConsultationServices => Set<ConsultationService>();
    public DbSet<ConsultationHour> ConsultationHours => Set<ConsultationHour>();
    public DbSet<ConsultationClosedDate> ConsultationClosedDates => Set<ConsultationClosedDate>();
    public DbSet<Appointment> Appointments => Set<Appointment>();

    // UTC audit columns are read back with Kind=Utc so JSON carries an explicit "Z".
    internal static readonly ValueConverter<DateTime, DateTime> UtcConverter =
        new(v => v, v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
    internal static readonly ValueConverter<DateTime?, DateTime?> NullableUtcConverter =
        new(v => v, v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);

    private static void ConfigureConsultation(ModelBuilder m)
    {
        m.Entity<ConsultationService>(e =>
        {
            e.ToTable("ConsultationServices");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Name).IsUnique();
            e.Property(x => x.Name).HasMaxLength(150);
            e.Property(x => x.Description).HasMaxLength(500);
            e.Property(x => x.Price).HasColumnType("decimal(18, 2)");
            e.Property(x => x.CreatedAt).HasColumnType("datetime2").HasConversion(UtcConverter);
            e.Property(x => x.UpdatedAt).HasColumnType("datetime2").HasConversion(NullableUtcConverter);
        });
        m.Entity<ConsultationHour>(e =>
        {
            e.ToTable("ConsultationHours");
            e.HasKey(x => x.DayOfWeek);
            e.Property(x => x.DayOfWeek).ValueGeneratedNever();
            e.Property(x => x.OpenTime).HasColumnType("time(0)");
            e.Property(x => x.CloseTime).HasColumnType("time(0)");
        });
        m.Entity<ConsultationClosedDate>(e =>
        {
            e.ToTable("ConsultationClosedDates");
            e.HasKey(x => x.Date);
            e.Property(x => x.Date).HasColumnType("date");
            e.Property(x => x.Reason).HasMaxLength(200);
        });
        m.Entity<Appointment>(e =>
        {
            e.ToTable("Appointments");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.UserId, x.RequestId }).IsUnique();
            e.HasIndex(x => new { x.StartAt, x.Status });
            e.Property(x => x.ServiceName).HasMaxLength(150);
            e.Property(x => x.Price).HasColumnType("decimal(18, 2)");
            e.Property(x => x.StartAt).HasColumnType("datetime2(0)");
            e.Property(x => x.EndAt).HasColumnType("datetime2(0)");
            e.Property(x => x.Status).HasMaxLength(20).IsUnicode(false);
            e.Property(x => x.ContactName).HasMaxLength(100);
            e.Property(x => x.Phone).HasMaxLength(20);
            e.Property(x => x.Note).HasMaxLength(500);
            e.Property(x => x.CancelReason).HasMaxLength(300);
            e.Property(x => x.CancelledBy).HasMaxLength(20).IsUnicode(false);
            e.Property(x => x.CreatedAt).HasColumnType("datetime2").HasConversion(UtcConverter);
            e.Property(x => x.UpdatedAt).HasColumnType("datetime2").HasConversion(NullableUtcConverter);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.NoAction);
            e.HasOne(x => x.Service).WithMany().HasForeignKey(x => x.ServiceId).OnDelete(DeleteBehavior.NoAction);
        });
    }
}
