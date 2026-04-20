using System.Text.Json;

namespace AutoClicker;

internal static class ProfilesStore
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    private static string ProfilesPath
    {
        get
        {
            var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "AutoClicker");
            Directory.CreateDirectory(dir);
            return Path.Combine(dir, "profiles.json");
        }
    }

    internal static Dictionary<string, AppSettings> Load()
    {
        try
        {
            if (!File.Exists(ProfilesPath))
                return new Dictionary<string, AppSettings>(StringComparer.OrdinalIgnoreCase);
            var json = File.ReadAllText(ProfilesPath);
            return JsonSerializer.Deserialize<Dictionary<string, AppSettings>>(json, JsonOptions)
                   ?? new Dictionary<string, AppSettings>(StringComparer.OrdinalIgnoreCase);
        }
        catch
        {
            return new Dictionary<string, AppSettings>(StringComparer.OrdinalIgnoreCase);
        }
    }

    internal static void Save(Dictionary<string, AppSettings> profiles)
    {
        var json = JsonSerializer.Serialize(profiles, JsonOptions);
        File.WriteAllText(ProfilesPath, json);
    }
}
