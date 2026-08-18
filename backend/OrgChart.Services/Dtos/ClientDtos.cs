using System;
using System.ComponentModel.DataAnnotations;

namespace OrgChart.Services.Dtos;

public class ClientDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int ProjectCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
}

public class CreateClientDto
{
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;
}

public class UpdateClientDto : CreateClientDto
{
}
