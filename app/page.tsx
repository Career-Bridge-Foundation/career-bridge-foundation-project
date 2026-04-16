import { supabase } from "@/lib/supabase";

export default async function Home() {
  const { data, error } = await supabase.from('test_connection').select()

  if (error) {
    return <div>Error connecting: {error.message}</div>
  }

  return (
    <div className="text-lg font-san font-grey-600">
      <h1>Supabase Connection Test</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
