import { useState } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/firebaseConfig";

interface ActivityData {
  firstname: string;
  reportDate: Timestamp; // Firestore Timestamp
  report: string;
}

interface UseGenerateActivityReturn {
  generateActivity: (
    activityType: string,
    customReport?: string
  ) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

// Activity type templates - focused on major changes only
const ACTIVITY_TEMPLATES = {
  // Dashboard activities
  dashboard_export: "Exported dashboard data",

  // Reports activities
  report_generate: "Generated health report",
  report_download: "Downloaded report",

  // Medical Records activities
  records_search: "Searched medical records",
  records_filter: "Applied filters to medical records",

  // CBC activities
  cbc_add: "Added new CBC record",
  cbc_edit: "Edited CBC record",
  cbc_delete: "Deleted CBC record",
  cbc_export: "Exported CBC data",

  // X-Ray activities
  xray_add: "Added new X-Ray record",
  xray_edit: "Edited X-Ray record",
  xray_delete: "Deleted X-Ray record",
  xray_upload: "Uploaded X-Ray image",

  // ECG activities
  ecg_add: "Added new ECG record",
  ecg_edit: "Edited ECG record",
  ecg_delete: "Deleted ECG record",

  // Urinalysis activities
  urinalysis_add: "Added new Urinalysis record",
  urinalysis_edit: "Edited Urinalysis record",
  urinalysis_delete: "Deleted Urinalysis record",

  // Lipid activities (Admin only)
  lipid_add: "Added new Lipid record",
  lipid_edit: "Edited Lipid record",
  lipid_delete: "Deleted Lipid record",

  // Profile activities
  profile_update: "Updated profile information",
  preferences_update: "Updated user preferences",

  // Auth activities
  login: "Logged into the system",
  logout: "Logged out of the system",

  // Admin activities
  user_management: "Accessed user management",
  system_settings: "Modified system settings",
  bulk_import: "Performed bulk data import",
  bulk_export: "Performed bulk data export",

  // Custom activity (fallback)
  custom: "Performed custom activity",
};

const useGenerateActivity = (): UseGenerateActivityReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentUser = async (): Promise<{
    firstname: string;
    email: string;
  } | null> => {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        unsubscribe(); // Unsubscribe immediately after getting the user

        if (!user) {
          resolve(null);
          return;
        }

        try {
          // Query the users collection to find the user document by email
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("email", "==", user.email));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            const data = userDoc.data();

            resolve({
              firstname: data.firstname || "",
              email: data.email || user.email || "",
            });
          } else {
            // Fallback if user document not found
            resolve({
              firstname: "",
              email: user.email || "",
            });
          }
        } catch (error) {
          console.error("Error fetching user data for activity:", error);
          // Fallback on error
          resolve({
            firstname: "",
            email: user.email || "",
          });
        }
      });
    });
  };

  const generateActivity = async (
    activityType: string,
    customReport?: string
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Get current user data
      const currentUser = await getCurrentUser();

      if (!currentUser) {
        throw new Error("User not authenticated");
      }

      // Generate report text
      const reportText =
        customReport ||
        ACTIVITY_TEMPLATES[activityType as keyof typeof ACTIVITY_TEMPLATES] ||
        `Performed ${activityType} activity`;

      // Create activity data
      const activityData: ActivityData = {
        firstname: currentUser.firstname || currentUser.email.split("@")[0], // Fallback to email username if no firstname
        reportDate: Timestamp.now(), // Use Firestore Timestamp
        report: reportText,
      };

      // Add to activities collection
      const activitiesRef = collection(db, "activities");
      await addDoc(activitiesRef, activityData);

      console.log("Activity logged successfully:", activityData);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to generate activity";
      setError(errorMessage);
      console.error("Error generating activity:", err);
      throw err; // Re-throw so calling component can handle if needed
    } finally {
      setIsLoading(false);
    }
  };

  return {
    generateActivity,
    isLoading,
    error,
  };
};

export default useGenerateActivity;

// Example usage in a component:
/*
import useGenerateActivity from '@/hooks/useGenerateActivity';

const MyComponent = () => {
  const { generateActivity, isLoading, error } = useGenerateActivity();

  const handleAddRecord = async () => {
    try {
      await generateActivity('cbc_add');
      // Continue with your existing logic
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  };

  const handleCustomActivity = async () => {
    try {
      await generateActivity('custom', 'User performed a special operation on medical data');
      // Continue with your existing logic
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  };

  return (
    <div>
      <button onClick={handleAddRecord}>Add Record</button>
      <button onClick={handleCustomActivity}>Custom Action</button>
      {isLoading && <p>Logging activity...</p>}
      {error && <p>Error: {error}</p>}
    </div>
  );
};
*/
