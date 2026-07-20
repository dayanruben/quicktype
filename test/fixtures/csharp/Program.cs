using System;

namespace QuickType
{
    class Program
    {
        static void Main(string[] args)
        {
            var path = args[0];
            var json = System.IO.File.ReadAllText(path);
            var output = TopLevel.FromJson(json).ToJson();

            if (System.IO.Path.GetFileName(path) == "enum.1.json")
            {
                var generatedSource = System.IO.File.ReadAllText("QuickType.cs");
                const string expectedEnum = "public enum Lvc { Lawful, Neutral, Chaotic };";
                if (!generatedSource.Contains(expectedEnum))
                {
                    throw new InvalidOperationException("Generated enum cases are not in schema order");
                }
            }

            Console.WriteLine("{0}", output);
        }
    }
}
