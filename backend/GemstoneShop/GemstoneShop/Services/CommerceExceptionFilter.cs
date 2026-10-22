using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Data.SqlClient;

namespace GemstoneShop.Services;

public class CommerceExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        var sql = context.Exception as SqlException ?? context.Exception.InnerException as SqlException;
        if (sql?.Number is 1205 or 51001)
        {
            context.Result = new ConflictObjectResult(new { code = "request_busy", message = "Yêu cầu đang được xử lý. Vui lòng thử lại với cùng mã yêu cầu." });
            context.ExceptionHandled = true;
        }
    }
}
