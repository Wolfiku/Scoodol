"use client";

import { useState } from 'react';
import ZeitplanDashboard from '@/app/components/zeitplan-dashboard';
import ClassicTimetableView from '@/app/components/classic-timetable-view';
import HomeworkPlanner from '@/app/components/homework-planner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Home() {
  return (
    <main className="container mx-auto p-4 md:p-8">
       <Tabs defaultValue="daily" className="w-full">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="daily">Tagesansicht</TabsTrigger>
            <TabsTrigger value="weekly">Wochenansicht</TabsTrigger>
            <TabsTrigger value="homework">Hausaufgaben</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="daily">
          <ZeitplanDashboard />
        </TabsContent>
        <TabsContent value="weekly">
          <ClassicTimetableView />
        </TabsContent>
        <TabsContent value="homework">
            <div className="max-w-4xl mx-auto">
             <HomeworkPlanner />
            </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}
