"use client";

import { useState } from 'react';
import ZeitplanDashboard from '@/app/components/zeitplan-dashboard';
import ClassicTimetableView from '@/app/components/classic-timetable-view';
import HomeworkPlanner from '@/app/components/homework-planner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Home() {
  return (
    <main className="container mx-auto p-4 md:p-8 relative min-h-screen">
       <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="daily">Tagesansicht</TabsTrigger>
          <TabsTrigger value="weekly">Wochenansicht</TabsTrigger>
          <TabsTrigger value="homework">Hausaufgaben</TabsTrigger>
        </TabsList>
        <TabsContent value="daily" className="mt-6">
          <ZeitplanDashboard />
        </TabsContent>
        <TabsContent value="weekly" className="mt-6">
          <ClassicTimetableView />
        </TabsContent>
        <TabsContent value="homework" className="mt-6">
          <HomeworkPlanner />
        </TabsContent>
      </Tabs>
    </main>
  );
}
