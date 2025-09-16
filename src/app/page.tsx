import ZeitplanDashboard from '@/app/components/zeitplan-dashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ClassicTimetableView from '@/app/components/classic-timetable-view';

export default function Home() {
  return (
    <main className="container mx-auto p-4 md:p-8">
       <Tabs defaultValue="daily" className="w-full">
        <div className="flex justify-center mb-4">
          <TabsList>
            <TabsTrigger value="daily">Tagesansicht</TabsTrigger>
            <TabsTrigger value="weekly">Wochenansicht</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="daily">
          <ZeitplanDashboard />
        </TabsContent>
        <TabsContent value="weekly">
          <ClassicTimetableView />
        </TabsContent>
      </Tabs>
    </main>
  );
}
