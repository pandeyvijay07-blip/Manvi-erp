import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type ProfileData = {
  business_name: string;
  owner_name: string;
  mobile: string;
};

export default function Profile() {
  const [profile, setProfile] = useState<ProfileData>({
    business_name: "",
    owner_name: "",
    mobile: "",
  });

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("business_name, owner_name, mobile")
      .eq("id", user.id)
      .single();

    if (error) {
      console.log(error);
      return;
    }

    setProfile(data);
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-md p-8">

        <h1 className="text-3xl font-bold text-blue-700 mb-6">
          My Profile
        </h1>

        <div className="space-y-5">

          <div>
            <label className="font-semibold">Business Name</label>
            <input
              className="w-full border rounded-lg p-3 mt-2 bg-gray-100"
              value={profile.business_name}
              readOnly
            />
          </div>

          <div>
            <label className="font-semibold">Owner Name</label>
            <input
              className="w-full border rounded-lg p-3 mt-2 bg-gray-100"
              value={profile.owner_name}
              readOnly
            />
          </div>

          <div>
            <label className="font-semibold">Mobile</label>
            <input
              className="w-full border rounded-lg p-3 mt-2 bg-gray-100"
              value={profile.mobile}
              readOnly
            />
          </div>

        </div>
      </div>
    </div>
  );
}